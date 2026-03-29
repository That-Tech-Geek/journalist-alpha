import os
import json
import uuid
import base64
import asyncio
import time
from datetime import datetime, timedelta
import httpx
import pandas as pd
import yfinance as yf
import google.generativeai as genai
import firebase_admin
from firebase_admin import credentials, firestore

# --- Initialization ---
_db_instance = None
_db_init_error = None

def get_db():
    global _db_instance, _db_init_error
    
    if _db_instance is not None:
        return _db_instance, None
        
    if firebase_admin._apps:
        try:
            _db_instance = firestore.client()
            return _db_instance, None
        except Exception as e:
            _db_init_error = f"Error getting firestore client: {str(e)}"
            return None, _db_init_error

    cred_env = os.environ.get("FIRESTORE_CREDENTIALS")
    if not cred_env:
        _db_init_error = "FIRESTORE_CREDENTIALS environment variable is missing."
        return None, _db_init_error

    try:
        cred_env = cred_env.strip()
        cred_dict = None
        
        # 1. Try parsing as raw JSON
        if cred_env.startswith('{'):
            # Handle potential escaped newlines from Vercel env vars
            clean_env = cred_env.replace('\\n', '\n')
            cred_dict = json.loads(clean_env)
        else:
            # 2. Try parsing as Base64
            # Fix padding if necessary (Base64 strings length should be a multiple of 4)
            padded_env = cred_env + '=' * (-len(cred_env) % 4)
            cred_json = base64.b64decode(padded_env).decode('utf-8')
            cred_dict = json.loads(cred_json)

        if not cred_dict:
            raise ValueError("Parsed credentials dictionary is empty.")

        cred = credentials.Certificate(cred_dict)
        firebase_admin.initialize_app(cred)
        _db_instance = firestore.client()
        return _db_instance, None
        
    except json.JSONDecodeError as e:
        _db_init_error = f"JSON parsing error in credentials: {str(e)}"
    except Exception as e:
        # Catch base64 binascii errors and other unexpected errors
        _db_init_error = f"Error initializing Firebase: {str(e)}"
        
    return None, _db_init_error

# Gemini
genai.configure(api_key=os.environ.get("GOOGLE_API_KEY"))
MODEL_NAME = os.environ.get("GEMINI_MODEL", "gemini-1.5-pro")

# --- Tools ---
def get_insider_buys(min_crores: float = 1.0, days_back: int = 7, market_cap_filter: str = 'all') -> list[dict]:
    """
    Fetch insider purchase transactions from BSE filings. Use when the journalist asks about promoters, directors, or employees buying shares of their own company.
    """
    try:
        to_dt = datetime.today().strftime('%Y%m%d')
        from_dt = (datetime.today() - timedelta(days=days_back)).strftime('%Y%m%d')
        url = f"https://api.bseindia.com/BseIndiaAPI/api/Insider_Trading/w?strSearch=&Type=C&dtFrom={from_dt}&dtTo={to_dt}&scripcode="
        headers = {'Referer': 'https://www.bseindia.com/', 'User-Agent': 'Mozilla/5.0'}
        
        with httpx.Client() as client:
            r = client.get(url, headers=headers, timeout=15.0)
            r.raise_for_status()
            data = r.json()
        
        if not data:
            return []
            
        df = pd.DataFrame(data)
        if df.empty:
            return []
            
        df.rename(columns={'scripCode': 'symbol', 'personName': 'insider_name', 'companyName': 'company_name', 'categoryName': 'insider_category', 'dateOfTransaction': 'trade_date', 'value': 'value_inr', 'transactionType': 'txn_type'}, inplace=True, errors='ignore')
        
        if 'txn_type' not in df.columns or 'value_inr' not in df.columns:
            return []
            
        df['value_cr'] = pd.to_numeric(df['value_inr'], errors='coerce') / 1e7
        df = df[df['txn_type'].str.upper() == 'BUY']
        df = df[df['value_cr'] >= min_crores]
        
        df['source_url'] = df.apply(lambda row: f"https://www.bseindia.com/corporates/Insider_Trading_new.aspx?scripcd={row.get('symbol', '')}", axis=1)
        
        cols_to_keep = ['symbol', 'company_name', 'insider_name', 'insider_category', 'trade_date', 'value_cr', 'source_url']
        available_cols = [c for c in cols_to_keep if c in df.columns]
        
        return df[available_cols].head(10).to_dict('records')
    except Exception as e:
        print(f"Error in get_insider_buys: {e}")
        return []

def get_bulk_deals(min_value_cr: float = 10.0, date_range: str = 'today') -> list[dict]:
    """
    Fetch bulk and block deals from NSE. Bulk deals are trades of >=0.5% of paid-up capital. Block deals are negotiated off-market. Use when journalist asks about large institutional trades or FII/DII activity.
    """
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://www.nseindia.com/market-data/bulk-deals',
            'Accept': 'application/json',
        }
        with httpx.Client() as client:
            client.get('https://www.nseindia.com', headers=headers, timeout=10.0)
            r = client.get('https://www.nseindia.com/api/bulk-deals', headers=headers, timeout=15.0)
            r.raise_for_status()
            data = r.json().get('data', [])
        
        if not data:
            return []
            
        df = pd.DataFrame(data)
        if df.empty:
            return []
            
        if 'quantity' in df.columns and 'tradePrice' in df.columns:
            df['value_cr'] = (pd.to_numeric(df['quantity'], errors='coerce') * pd.to_numeric(df['tradePrice'], errors='coerce')) / 1e7
        else:
            df['value_cr'] = 0.0
            
        df = df[df['value_cr'] >= min_value_cr]
        
        df.rename(columns={'clientName': 'client_name', 'buyOrSell': 'buy_sell', 'date': 'trade_date'}, inplace=True, errors='ignore')
        df['source_url'] = 'https://www.nseindia.com/market-data/bulk-deals'
        
        cols_to_keep = ['symbol', 'client_name', 'buy_sell', 'quantity', 'value_cr', 'trade_date', 'source_url']
        available_cols = [c for c in cols_to_keep if c in df.columns]
        
        return df[available_cols].head(10).to_dict('records')
    except Exception as e:
        print(f"Error in get_bulk_deals: {e}")
        return []

def detect_breakouts(min_success_rate: float = 0.6, pattern_types: list = None) -> list[dict]:
    """
    Detect technical chart patterns that historically lead to price increases. Use when journalist asks for stocks showing bullish patterns, breakouts, or momentum.
    """
    # Mock implementation for hackathon
    return [
        {
            "symbol": "RELIANCE",
            "pattern": "52w_high",
            "success_rate": 0.68,
            "avg_return_10d": 4.5,
            "sample_size": 45,
            "detected_date": datetime.today().strftime('%Y-%m-%d'),
            "chart_url": "https://www.tradingview.com/chart/?symbol=NSE:RELIANCE"
        },
        {
            "symbol": "TCS",
            "pattern": "bullish_flag",
            "success_rate": 0.71,
            "avg_return_10d": 5.2,
            "sample_size": 32,
            "detected_date": datetime.today().strftime('%Y-%m-%d'),
            "chart_url": "https://www.tradingview.com/chart/?symbol=NSE:TCS"
        }
    ]

tool_map = {
    "get_insider_buys": get_insider_buys,
    "get_bulk_deals": get_bulk_deals,
    "detect_breakouts": detect_breakouts
}

# --- Prompts ---
RESEARCH_PROMPT = """
You are an AI research assistant for financial journalists. Your job is to gather accurate market data by calling the provided tools. Never guess data. If a tool returns empty, say "No data found for the given criteria." After collecting data, provide a concise summary of the findings (no story lead yet). This summary will be shown to the journalist for approval.
"""

REPORT_PROMPT = """
You are a senior financial journalist at The Economic Times. Convert the following structured data into a clear, newsworthy story lead. Follow these rules exactly:
1. No jargon: explain all technical terms in plain English.
2. Cite sources: every claim must end with [Source: BSE/NSE filing].
3. Output format:
   📰 STORY LEAD (2–3 sentences, past tense)
   📊 KEY NUMBERS (3–5 bullet points with exact figures)
   🔗 SOURCE LINKS (list filing URLs)
   🐦 TWEET (≤280 characters, include $TICKER and #IndianMarkets)
   ⚠ DISCLAIMER: This is not investment advice.
Do not add any extra commentary.
"""

# --- ASGI Helper ---
async def read_body(receive):
    body = b''
    more_body = True
    while more_body:
        message = await receive()
        body += message.get('body', b'')
        more_body = message.get('more_body', False)
    return body

async def send_json(send, status_code, data):
    await send({
        'type': 'http.response.start',
        'status': status_code,
        'headers': [(b'content-type', b'application/json')]
    })
    await send({
        'type': 'http.response.body',
        'body': json.dumps(data).encode('utf-8')
    })

# --- Handlers ---
async def handle_chat(body_json):
    message = body_json.get('message')
    thread_id = body_json.get('thread_id')
    
    if not thread_id:
        thread_id = str(uuid.uuid4())
        
    db, db_error = get_db()
    if not db:
        return {"error": f"Database not initialized. Details: {db_error}"}, 500
        
    doc_ref = db.collection('agent_checkpoints').document(thread_id)
    doc = doc_ref.get()
    
    if doc.exists:
        state = doc.to_dict()
        if state.get('phase') == 'awaiting_approval':
            return {"status": "awaiting_approval", "thread_id": thread_id}, 200
            
    # Run Gemini Research Phase
    start_time = time.time()
    model = genai.GenerativeModel(model_name=MODEL_NAME, tools=list(tool_map.values()), system_instruction=RESEARCH_PROMPT)
    chat = model.start_chat()
    
    tool_results_log = []
    
    try:
        response = chat.send_message(message)
        
        # Handle function calls
        while response.parts and any(part.function_call for part in response.parts):
            function_responses = []
            for part in response.parts:
                if part.function_call:
                    fc = part.function_call
                    tool_name = fc.name
                    args = {k: v for k, v in fc.args.items()}
                    
                    if tool_name in tool_map:
                        result = tool_map[tool_name](**args)
                        function_responses.append(
                            genai.protos.Part(
                                function_response=genai.protos.FunctionResponse(
                                    name=tool_name,
                                    response={"result": result}
                                )
                            )
                        )
                        tool_results_log.append({
                            "tool_name": tool_name,
                            "arguments": args,
                            "result": result
                        })
            
            if function_responses:
                response = chat.send_message(function_responses)
            else:
                break
                
        pending_analysis = response.text
        latency = int((time.time() - start_time) * 1000)
        
        # Save state
        doc_ref.set({
            'phase': 'awaiting_approval',
            'query': message,
            'pending_analysis': pending_analysis,
            'tool_results': tool_results_log,
            'updated_at': firestore.SERVER_TIMESTAMP,
            'created_at': firestore.SERVER_TIMESTAMP
        })
        
        # Create approval queue doc
        preview_data = tool_results_log[0]['result'][:3] if tool_results_log and tool_results_log[0]['result'] else []
        db.collection('approval_queue').document(thread_id).set({
            'status': 'pending',
            'preview_data': preview_data,
            'created_at': firestore.SERVER_TIMESTAMP
        })
        
        # Log audit
        db.collection('audit_logs').add({
            'thread_id': thread_id,
            'query': message,
            'tool_calls': tool_results_log,
            'latency_ms': latency,
            'timestamp': firestore.SERVER_TIMESTAMP,
            'phase': 'research'
        })
        
        return {"status": "awaiting_approval", "thread_id": thread_id, "preview": preview_data, "analysis": pending_analysis}, 200
        
    except Exception as e:
        print(f"Error in chat: {e}")
        return {"error": str(e)}, 500

async def handle_get_approval(thread_id):
    db, db_error = get_db()
    if not db:
        return {"error": f"Database not initialized. Details: {db_error}"}, 500
        
    doc = db.collection('approval_queue').document(thread_id).get()
    if doc.exists:
        return doc.to_dict(), 200
    return {"status": "not_found"}, 404

async def handle_post_approve(thread_id, body_json):
    action = body_json.get('action')
    
    db, db_error = get_db()
    if not db:
        return {"error": f"Database not initialized. Details: {db_error}"}, 500
        
    if action == 'reject':
        db.collection('agent_checkpoints').document(thread_id).update({'phase': 'rejected'})
        db.collection('approval_queue').document(thread_id).delete()
        return {"status": "rejected"}, 200
        
    if action == 'approve':
        doc = db.collection('agent_checkpoints').document(thread_id).get()
        if not doc.exists:
            return {"error": "Thread not found"}, 404
            
        state = doc.to_dict()
        pending_analysis = state.get('pending_analysis', '')
        tool_results = state.get('tool_results', [])
        
        start_time = time.time()
        model = genai.GenerativeModel(model_name=MODEL_NAME, system_instruction=REPORT_PROMPT)
        
        prompt = f"Data:\n{json.dumps(tool_results)}\n\nAnalysis:\n{pending_analysis}"
        
        try:
            response = model.generate_content(prompt)
            final_output = response.text
            latency = int((time.time() - start_time) * 1000)
            
            db.collection('agent_checkpoints').document(thread_id).update({
                'phase': 'complete',
                'updated_at': firestore.SERVER_TIMESTAMP
            })
            db.collection('approval_queue').document(thread_id).delete()
            
            db.collection('audit_logs').add({
                'thread_id': thread_id,
                'query': state.get('query'),
                'human_approval': {'action': 'approve', 'timestamp': firestore.SERVER_TIMESTAMP},
                'final_output': final_output,
                'latency_ms': latency,
                'timestamp': firestore.SERVER_TIMESTAMP,
                'phase': 'report'
            })
            
            return {"status": "complete", "response": final_output}, 200
        except Exception as e:
            return {"error": str(e)}, 500
            
    return {"error": "Invalid action"}, 400

# --- Main ASGI Handler ---
async def handler(scope, receive, send):
    if scope['type'] == 'lifespan':
        while True:
            message = await receive()
            if message['type'] == 'lifespan.startup':
                await send({'type': 'lifespan.startup.complete'})
            elif message['type'] == 'lifespan.shutdown':
                await send({'type': 'lifespan.shutdown.complete'})
                return
                
    if scope['type'] != 'http':
        return

    method = scope['method']
    path = scope['path']
    
    try:
        if path == '/api/chat' and method == 'POST':
            body = await read_body(receive)
            body_json = json.loads(body) if body else {}
            data, status = await handle_chat(body_json)
            await send_json(send, status, data)
            
        elif path.startswith('/api/approval/') and method == 'GET':
            thread_id = path.split('/')[-1]
            data, status = await handle_get_approval(thread_id)
            await send_json(send, status, data)
            
        elif path.startswith('/api/approve/') and method == 'POST':
            thread_id = path.split('/')[-1]
            body = await read_body(receive)
            body_json = json.loads(body) if body else {}
            data, status = await handle_post_approve(thread_id, body_json)
            await send_json(send, status, data)
            
        else:
            await send_json(send, 404, {"error": "Not found"})
    except Exception as e:
        print(f"Unhandled error: {e}")
        await send_json(send, 500, {"error": "Internal server error"})

app = handler
