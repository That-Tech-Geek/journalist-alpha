'use client';

import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { Search, Loader2, CheckCircle2, FileText, ArrowRight } from 'lucide-react';
import { marked } from 'marked';
import { getHistoricalStockData, getStockQuote } from '@/app/actions/finance';

type Step = {
  id: string;
  title: string;
  status: 'pending' | 'active' | 'complete' | 'error';
  content?: string;
  sources?: { uri: string; title: string }[];
};

export default function DeepResearch() {
  const [query, setQuery] = useState('');
  const [isResearching, setIsResearching] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [finalReport, setFinalReport] = useState<string | null>(null);
  const [allSources, setAllSources] = useState<{ uri: string; title: string }[]>([]);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (finalReport && reportRef.current) {
      reportRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [finalReport]);

  const startResearch = async () => {
    if (!query.trim()) return;

    setIsResearching(true);
    setFinalReport(null);
    setAllSources([]);
    
    const initialSteps: Step[] = [
      { id: 'plan', title: 'Generating Research Plan & Initial Search', status: 'active' },
      { id: 'gap1', title: 'Identifying Knowledge Gaps & Deepening Search', status: 'pending' },
      { id: 'gap2', title: 'Final Verification Search', status: 'pending' },
      { id: 'report', title: 'Synthesizing Final Report', status: 'pending' }
    ];
    setSteps(initialSteps);

    try {
      // 1. Model Setup: Initialize Gemini using the Google GenAI SDK
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("NEXT_PUBLIC_GEMINI_API_KEY is missing. Please add it to your .env file.");
      }

      const ai = new GoogleGenAI({ apiKey });
      
      // We use a chat session to maintain context across the iterative loop
      const chat = ai.chats.create({
        model: 'gemini-2.5-flash-lite,
        config: {
          // 2. Tool Calling: Give Gemini access to the built-in Google Search API and custom Yahoo Finance tools
          tools: [
            { googleSearch: {} },
            {
              functionDeclarations: [
                {
                  name: 'getHistoricalStockData',
                  description: 'Get historical stock price data (close price and volume) for a given symbol.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      symbol: { type: Type.STRING, description: 'Stock ticker symbol (e.g., AAPL)' },
                      from: { type: Type.STRING, description: 'Start date in YYYY-MM-DD format' },
                      to: { type: Type.STRING, description: 'End date in YYYY-MM-DD format' }
                    },
                    required: ['symbol', 'from', 'to']
                  }
                },
                {
                  name: 'getStockQuote',
                  description: 'Get the current stock quote and key statistics for a given symbol.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      symbol: { type: Type.STRING, description: 'Stock ticker symbol (e.g., AAPL)' }
                    },
                    required: ['symbol']
                  }
                }
              ]
            }
          ],
          toolConfig: { includeServerSideToolInvocations: true },
          systemInstruction: `You are an expert investigative research agent and financial analyst. 
Your goal is to thoroughly research a topic by executing searches, parsing results, identifying gaps, and synthesizing a final report.
Always use the googleSearch tool to find up-to-date and accurate information.
If the user asks about specific stocks, use the getHistoricalStockData and getStockQuote tools to fetch real financial data.
When synthesizing the final report, use Markdown and include citations to the sources you found.`,
        }
      });

      const collectedSources: { uri: string; title: string }[] = [];

      const extractSources = (response: any) => {
        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (chunks) {
          chunks.forEach((chunk: any) => {
            if (chunk.web?.uri && chunk.web?.title) {
              if (!collectedSources.find(s => s.uri === chunk.web.uri)) {
                collectedSources.push({ uri: chunk.web.uri, title: chunk.web.title });
              }
            }
          });
        }
      };

      const handleToolCalls = async (response: any, currentMessage: any) => {
        let currentResponse = response;
        let messageHistory = currentMessage;
        
        while (currentResponse.functionCalls && currentResponse.functionCalls.length > 0) {
          const functionResponses = [];
          
          for (const call of currentResponse.functionCalls) {
            let result = '';
            try {
              if (call.name === 'getHistoricalStockData') {
                result = await getHistoricalStockData(call.args as any);
              } else if (call.name === 'getStockQuote') {
                result = await getStockQuote(call.args as any);
              }
            } catch (err: any) {
              result = JSON.stringify({ error: err.message });
            }
            
            functionResponses.push({
              name: call.name,
              response: { result }
            });
          }
          
          // Send the tool responses back to the model
          messageHistory = [
            currentResponse.candidates[0].content,
            { functionResponses }
          ];
          
          currentResponse = await chat.sendMessage({ message: messageHistory });
          extractSources(currentResponse);
        }
        
        return currentResponse;
      };

      // 3. Iterative Logic - Step 1: Research Plan & Initial Search
      let response = await chat.sendMessage({ 
        message: `The user wants to research: "${query}". 
Generate a research plan, execute initial searches using the googleSearch tool to gather baseline information, and summarize your initial findings.` 
      });
      
      extractSources(response);
      response = await handleToolCalls(response, `The user wants to research: "${query}". Generate a research plan...`);
      
      setSteps(prev => prev.map(s => s.id === 'plan' ? { ...s, status: 'complete', content: response.text, sources: [...collectedSources] } : s));
      setSteps(prev => prev.map(s => s.id === 'gap1' ? { ...s, status: 'active' } : s));

      // 3. Iterative Logic - Step 2: Identify Gaps & Deepen
      response = await chat.sendMessage({
        message: `Review your initial findings. Identify any knowledge gaps, missing perspectives, or areas that need deeper investigation. 
Execute additional searches using the googleSearch tool to fill these gaps. Summarize the new findings.`
      });

      extractSources(response);
      response = await handleToolCalls(response, `Review your initial findings. Identify any knowledge gaps...`);

      setSteps(prev => prev.map(s => s.id === 'gap1' ? { ...s, status: 'complete', content: response.text, sources: [...collectedSources] } : s));
      setSteps(prev => prev.map(s => s.id === 'gap2' ? { ...s, status: 'active' } : s));

      // 3. Iterative Logic - Step 3: Final Verification
      response = await chat.sendMessage({
        message: `Perform one final review of all gathered information. Are there any conflicting reports, recent updates, or final details needed? 
Execute a final search to verify facts and gather any remaining context. Summarize the final verification.`
      });

      extractSources(response);
      response = await handleToolCalls(response, `Perform one final review of all gathered information...`);

      setSteps(prev => prev.map(s => s.id === 'gap2' ? { ...s, status: 'complete', content: response.text, sources: [...collectedSources] } : s));
      setSteps(prev => prev.map(s => s.id === 'report' ? { ...s, status: 'active' } : s));
      
      setAllSources(collectedSources);

      // 4. Synthesize Final Report
      response = await chat.sendMessage({
        message: `Based on all the research conducted in the previous steps, synthesize a comprehensive, well-structured final report in Markdown format. 
Include an executive summary, detailed sections, and a conclusion. 
Ensure you cite the sources you found using inline references or a references section at the bottom.`
      });

      setSteps(prev => prev.map(s => s.id === 'report' ? { ...s, status: 'complete' } : s));
      setFinalReport(response.text || "No report generated.");

    } catch (error: any) {
      console.error("Research error:", error);
      setSteps(prev => prev.map(s => s.status === 'active' ? { ...s, status: 'error', content: error.message } : s));
    } finally {
      setIsResearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
          <h1 className="text-3xl font-bold text-slate-800 mb-2 flex items-center gap-3">
            <Search className="w-8 h-8 text-blue-600" />
            Deep Research Agent
          </h1>
          <p className="text-slate-500 mb-6">
            An iterative research loop powered by Gemini 2.5 Flash and Google Search Grounding.
          </p>
          
          <div className="flex gap-3">
            <input 
              type="text" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isResearching && startResearch()}
              disabled={isResearching}
              placeholder="Enter a complex research topic (e.g., 'Impact of solid-state batteries on EV market by 2030')"
              className="flex-1 border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
            />
            <button 
              onClick={startResearch}
              disabled={isResearching || !query.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isResearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
              {isResearching ? 'Researching...' : 'Start Research'}
            </button>
          </div>
        </div>

        {steps.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-800">Research Progress</h2>
            <div className="grid gap-4">
              {steps.map((step, index) => (
                <div key={step.id} className={`bg-white p-5 rounded-xl border ${step.status === 'active' ? 'border-blue-400 shadow-md ring-1 ring-blue-400' : 'border-slate-200 shadow-sm'} transition-all`}>
                  <div className="flex items-center gap-3 mb-2">
                    {step.status === 'complete' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                    {step.status === 'active' && <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />}
                    {step.status === 'pending' && <div className="w-5 h-5 rounded-full border-2 border-slate-300" />}
                    {step.status === 'error' && <div className="w-5 h-5 rounded-full bg-red-500" />}
                    
                    <h3 className={`font-medium ${step.status === 'active' ? 'text-blue-700' : 'text-slate-700'}`}>
                      Step {index + 1}: {step.title}
                    </h3>
                  </div>
                  
                  {step.content && (
                    <div className="mt-3 pl-8">
                      <div className="text-sm text-slate-600 bg-slate-50 p-4 rounded-lg border border-slate-100 max-h-40 overflow-y-auto prose prose-sm">
                        <div dangerouslySetInnerHTML={{ __html: marked.parse(step.content) as string }} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {finalReport && (
          <div ref={reportRef} className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-100">
              <FileText className="w-8 h-8 text-blue-600" />
              <h2 className="text-2xl font-bold text-slate-800">Final Synthesized Report</h2>
            </div>
            
            <div className="prose prose-slate max-w-none prose-headings:text-slate-800 prose-a:text-blue-600 hover:prose-a:text-blue-800">
              <div dangerouslySetInnerHTML={{ __html: marked.parse(finalReport) as string }} />
            </div>

            {allSources.length > 0 && (
              <div className="mt-12 pt-8 border-t border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Sources Consulted</h3>
                <ul className="space-y-2">
                  {allSources.map((source, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <span className="text-slate-400 mt-0.5">[{idx + 1}]</span>
                      <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {source.title || source.uri}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
