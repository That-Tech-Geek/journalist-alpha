'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { Send, PlusCircle, TrendingUp, Activity, BarChart2, AlertCircle, LogOut } from 'lucide-react';
import { marked } from 'marked';

type Message = {
  id: string;
  role: 'user' | 'agent';
  content: string;
  isHtml?: boolean;
  isApproval?: boolean;
  previewData?: any;
  analysis?: string;
};

export default function AlphaCopilot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const isEvaluator = localStorage.getItem('evaluatorBypass') === 'true';
    if (isEvaluator) {
      setUser({ email: 'evaluator@example.com', isEvaluator: true });
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push('/login');
      } else {
        setUser(currentUser);
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    const storedThread = sessionStorage.getItem('thread_id');
    if (storedThread) setThreadId(storedThread);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const resetThread = () => {
    sessionStorage.removeItem('thread_id');
    setThreadId(null);
    setMessages([]);
  };

  const handleSend = async (text: string = input) => {
    if (!text.trim()) return;
    
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, thread_id: threadId })
      });
      
      const data = await res.json();
      
      if (data.error) {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'agent', content: `Error: ${data.error}` }]);
        return;
      }

      if (data.thread_id) {
        setThreadId(data.thread_id);
        sessionStorage.setItem('thread_id', data.thread_id);
      }

      if (data.status === 'awaiting_approval') {
        setMessages(prev => [...prev, { 
          id: Date.now().toString(), 
          role: 'agent', 
          content: '', 
          isApproval: true, 
          analysis: data.analysis, 
          previewData: data.preview 
        }]);
      } else if (data.status === 'complete') {
        setMessages(prev => [...prev, { 
          id: Date.now().toString(), 
          role: 'agent', 
          content: marked.parse(data.response) as string, 
          isHtml: true 
        }]);
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'agent', 
        content: `Connection error: ${err.message}\n\n**Note for AI Studio Preview:** This environment runs a Node.js dev server. The Python backend (\`api/index.py\`) requires deployment to Vercel to execute. Please deploy the repository to Vercel to test the full backend functionality.`,
        isHtml: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const submitApproval = async (action: 'approve' | 'reject', msgId: string) => {
    setIsLoading(true);
    // Optimistically update UI to remove buttons
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isApproval: false, content: `*Action selected: ${action}*`, isHtml: true } : m));

    try {
      const res = await fetch(`/api/approve/${threadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      
      if (data.error) {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'agent', content: `Error: ${data.error}` }]);
      } else if (data.status === 'complete') {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'agent', content: marked.parse(data.response) as string, isHtml: true }]);
      } else if (data.status === 'rejected') {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'agent', content: 'Report rejected. You can start a new query.' }]);
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'agent', content: `Approval error: ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      localStorage.removeItem('evaluatorBypass');
      await signOut(auth);
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="bg-slate-900 text-white p-4 shadow-md flex justify-between items-center z-10">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-400" />
            Journalist&apos;s Alpha Copilot
          </h1>
          <p className="text-xs text-slate-400 mt-1">ET AI Hackathon 2026</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={resetThread}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-md text-sm transition-colors border border-slate-700"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden sm:inline">New Story</span>
          </button>
          <button 
            onClick={handleSignOut}
            className="flex items-center gap-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 px-4 py-2 rounded-md text-sm transition-colors border border-red-900/50"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Chat Container */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          
          {messages.length === 0 && (
            <div className="text-center mt-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-2xl mx-auto">
                <h2 className="text-2xl font-semibold text-slate-800 mb-2">Welcome to Alpha Copilot</h2>
                <p className="text-slate-500 mb-8">Your AI research assistant for Indian Capital Markets. What would you like to investigate today?</p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                  <button onClick={() => handleSend('Show me insider buys above 5 crore in the last 7 days.')} className="p-4 border border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group text-left">
                    <TrendingUp className="w-5 h-5 text-blue-500 mb-2 group-hover:scale-110 transition-transform" />
                    <h3 className="font-medium text-sm text-slate-800">Insider Buys</h3>
                    <p className="text-xs text-slate-500 mt-1">Track promoter & executive accumulation</p>
                  </button>
                  <button onClick={() => handleSend('Any bulk deals today worth more than 20 crore?')} className="p-4 border border-slate-200 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all group text-left">
                    <BarChart2 className="w-5 h-5 text-purple-500 mb-2 group-hover:scale-110 transition-transform" />
                    <h3 className="font-medium text-sm text-slate-800">Bulk Deals</h3>
                    <p className="text-xs text-slate-500 mt-1">Monitor institutional block trades</p>
                  </button>
                  <button onClick={() => handleSend('Which stocks broke out to a 52-week high yesterday?')} className="p-4 border border-slate-200 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition-all group text-left">
                    <Activity className="w-5 h-5 text-emerald-500 mb-2 group-hover:scale-110 transition-transform" />
                    <h3 className="font-medium text-sm text-slate-800">Breakouts</h3>
                    <p className="text-xs text-slate-500 mt-1">Detect technical chart patterns</p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
              <div className={`max-w-[85%] rounded-2xl p-5 ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-tr-sm shadow-md' 
                  : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm'
              }`}>
                {msg.role === 'agent' && <div className="font-semibold text-xs text-blue-600 mb-2 uppercase tracking-wider">Alpha Copilot</div>}
                
                {msg.isHtml ? (
                  <div className="prose prose-sm max-w-none prose-a:text-blue-600 prose-headings:font-semibold" dangerouslySetInnerHTML={{ __html: msg.content }} />
                ) : msg.isApproval ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-amber-700 bg-amber-50 p-3 rounded-md border border-amber-200">
                      <AlertCircle className="w-5 h-5" />
                      <span className="text-sm font-medium">Research Complete. Awaiting Human Approval.</span>
                    </div>
                    
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm whitespace-pre-wrap font-mono text-slate-700">
                      {msg.analysis}
                    </div>
                    
                    {msg.previewData && msg.previewData.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Raw Data Preview</div>
                        <pre className="bg-slate-900 text-emerald-400 p-4 rounded-lg text-xs overflow-x-auto border border-slate-800 shadow-inner">
                          {JSON.stringify(msg.previewData, null, 2)}
                        </pre>
                      </div>
                    )}
                    
                    <div className="flex gap-3 pt-2">
                      <button 
                        onClick={() => submitApproval('approve', msg.id)}
                        disabled={isLoading}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg font-medium text-sm transition-colors shadow-sm disabled:opacity-50"
                      >
                        Approve & Generate Report
                      </button>
                      <button 
                        onClick={() => submitApproval('reject', msg.id)}
                        disabled={isLoading}
                        className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-2.5 rounded-lg font-medium text-sm transition-colors shadow-sm disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start animate-in fade-in">
              <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm p-5 shadow-sm flex items-center gap-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                </div>
                <span className="text-sm text-slate-500 font-medium">Analyzing market data...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer className="bg-white border-t border-slate-200 p-4 z-10">
        <div className="max-w-4xl mx-auto relative">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSend()}
            disabled={isLoading}
            className="w-full border border-slate-300 rounded-xl pl-4 pr-12 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm disabled:bg-slate-50 disabled:text-slate-500 text-sm"
            placeholder="Ask about insider trades, bulk deals, or chart patterns..."
          />
          <button 
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="max-w-4xl mx-auto mt-2 text-center">
          <p className="text-xs text-slate-400">Alpha Copilot can make mistakes. Verify critical claims with SEBI filings.</p>
        </div>
      </footer>
    </div>
  );
}
