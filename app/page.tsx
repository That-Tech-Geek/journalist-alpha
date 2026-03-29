'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, BarChart2, ShieldCheck, Zap, Activity, BookOpen, Database, TrendingUp, Layers, UserCheck, Search } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';

export default function LandingPage() {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleEvaluatorAccess = () => {
    try {
      localStorage.setItem('evaluatorBypass', 'true');
      router.push('/chat');
    } catch (e) {
      console.error('Evaluator access failed:', e);
      router.push('/login');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Navigation */}
      <nav className="bg-slate-900 text-white py-4 px-6 sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-400" />
            <span className="font-bold text-xl tracking-tight">Alpha Copilot</span>
          </div>
          <div className="flex gap-4 items-center">
            <Link href="/deep-research" className="text-sm font-medium hover:text-blue-400 transition-colors py-2">Deep Research</Link>
            {user ? (
              <Link href="/chat" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-md text-sm font-medium transition-colors">
                Open Copilot
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-sm font-medium hover:text-blue-400 transition-colors py-2">Log In</Link>
                <Link href="/login" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-md text-sm font-medium transition-colors">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-24 pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/finance/1920/1080?blur=10')] bg-cover bg-center opacity-10"></div>
        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-block mb-4 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold tracking-wider uppercase">
            ET AI Hackathon 2026
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 mb-6 leading-tight">
            The Ultimate Research Assistant for <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-emerald-500">Retail Investors & Journalists</span>
          </h1>
          <p className="text-xl text-slate-600 mb-10 max-w-3xl mx-auto leading-relaxed">
            Stop digging through endless SEC filings, confusing charts, and noisy news feeds. Alpha Copilot uses advanced AI to instantly analyze stocks, track insider trades, and generate clear, actionable insights in plain English.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href={user ? "/chat" : "/login"} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg text-lg font-semibold transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2">
              {user ? "Open Copilot" : "Get Started for Free"} <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/deep-research" className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-lg text-lg font-semibold transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2">
              Try Deep Research <Search className="w-5 h-5" />
            </Link>
            {!user && (
              <button onClick={handleEvaluatorAccess} className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-4 rounded-lg text-lg font-semibold transition-all shadow-sm flex items-center justify-center gap-2">
                <UserCheck className="w-5 h-5 text-slate-300" /> Try as Guest (Evaluator)
              </button>
            )}
            <a href="#features" className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 px-8 py-4 rounded-lg text-lg font-semibold transition-all shadow-sm flex items-center justify-center gap-2">
              See How It Works
            </a>
          </div>
        </div>
      </section>

      {/* Consumer POV Features */}
      <section id="features" className="py-20 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Investing is hard. We make it simple.</h2>
            <p className="text-slate-600 max-w-2xl mx-auto text-lg">
              Whether you are a retail investor looking for your next big trade, or a journalist breaking the next big story, Alpha Copilot does the heavy lifting for you.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-10">
            <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-6">
                <Search className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Deep Research Agent</h3>
              <p className="text-slate-600 leading-relaxed">
                Just ask a question like "How will solid-state batteries affect Tesla?" Our autonomous agent will scour the web, read the latest news, pull historical stock data, and write a comprehensive, cited report for you in seconds.
              </p>
            </div>
            
            <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-6">
                <Activity className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Follow the Smart Money</h3>
              <p className="text-slate-600 leading-relaxed">
                Want to know what the CEOs are buying? Our Copilot tracks real-time insider trades and massive institutional block deals. We alert you when the people running the company are betting big on their own stock.
              </p>
            </div>
            
            <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-14 h-14 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-6">
                <BookOpen className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Jargon-Free Insights</h3>
              <p className="text-slate-600 leading-relaxed">
                No more staring at confusing candlestick charts or reading 100-page earnings reports. We translate complex financial data, P/E ratios, and technical breakouts into plain English summaries you can actually understand.
              </p>
            </div>
          </div>
        </div>
      </section>
      {/* The 75% Efficiency Benchmark */}
      <section className="py-24 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-12">Why Alpha Copilot?</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-800 border-b border-slate-700">
                  <th className="p-4 font-semibold text-slate-300">Task</th>
                  <th className="p-4 font-semibold text-slate-300">Doing it Yourself</th>
                  <th className="p-4 font-semibold text-slate-300">With Alpha Copilot</th>
                  <th className="p-4 font-semibold text-slate-300">Time Saved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                <tr className="hover:bg-slate-800 transition-colors">
                  <td className="p-4 text-slate-200 font-medium">Researching a new stock</td>
                  <td className="p-4 text-slate-400">2-3 hours of reading</td>
                  <td className="p-4 text-emerald-400 font-bold">15 seconds</td>
                  <td className="p-4 text-blue-400 font-bold">99%</td>
                </tr>
                <tr className="hover:bg-slate-800 transition-colors">
                  <td className="p-4 text-slate-200 font-medium">Finding insider trades</td>
                  <td className="p-4 text-slate-400">Checking SEC/BSE daily</td>
                  <td className="p-4 text-emerald-400 font-bold">Instant alerts</td>
                  <td className="p-4 text-blue-400 font-bold">100%</td>
                </tr>
                <tr className="hover:bg-slate-800 transition-colors">
                  <td className="p-4 text-slate-200 font-medium">Analyzing P/E & Market Cap</td>
                  <td className="p-4 text-slate-400">Spreadsheets & Math</td>
                  <td className="p-4 text-emerald-400 font-bold">Done automatically</td>
                  <td className="p-4 text-blue-400 font-bold">100%</td>
                </tr>
                <tr className="hover:bg-slate-800 transition-colors">
                  <td className="p-4 text-slate-200 font-medium">Writing a summary report</td>
                  <td className="p-4 text-slate-400">30-45 minutes</td>
                  <td className="p-4 text-emerald-400 font-bold">8 seconds</td>
                  <td className="p-4 text-blue-400 font-bold">95%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-blue-600 text-white text-center">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-4xl font-bold mb-6">Ready to invest smarter?</h2>
          <p className="text-blue-100 text-xl mb-10">
            Join thousands of retail investors and journalists who are using AI to uncover the real story behind the stock market.
          </p>
          <Link href={user ? "/chat" : "/login"} className="inline-block bg-white text-blue-600 hover:bg-slate-50 px-10 py-4 rounded-lg text-lg font-bold transition-all shadow-lg hover:shadow-xl">
            Get Started for Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-8 text-center border-t border-slate-800">
        <p className="text-sm">© 2026 Journalist&apos;s Alpha Copilot. ET AI Hackathon Submission.</p>
        <p className="text-xs mt-2">Disclaimer: This tool is for informational and editorial purposes only and does not constitute investment advice.</p>
      </footer>
    </div>
  );
}
