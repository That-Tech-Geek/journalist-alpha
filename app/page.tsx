'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, BarChart2, ShieldCheck, Zap, Activity, BookOpen, Database, TrendingUp, Layers, UserCheck } from 'lucide-react';
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
          <div className="flex gap-4">
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
            The Agentic Framework for <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-emerald-500">Indian Capital Markets</span>
          </h1>
          <p className="text-xl text-slate-600 mb-10 max-w-3xl mx-auto leading-relaxed">
            Transition from an &quot;answer engine&quot; to a &quot;reasoning agent&quot;. Synthesize vast arrays of market data, regulatory filings, and quantitative signals into coherent, verifiable, and compliant narratives.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href={user ? "/chat" : "/login"} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg text-lg font-semibold transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2">
              {user ? "Open Copilot" : "Start Reporting"} <ArrowRight className="w-5 h-5" />
            </Link>
            {!user && (
              <button onClick={handleEvaluatorAccess} className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-4 rounded-lg text-lg font-semibold transition-all shadow-sm flex items-center justify-center gap-2">
                <UserCheck className="w-5 h-5 text-slate-300" /> Evaluator Bypass
              </button>
            )}
            <a href="#architecture" className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 px-8 py-4 rounded-lg text-lg font-semibold transition-all shadow-sm flex items-center justify-center gap-2">
              Explore the Model
            </a>
          </div>
        </div>
      </section>

      {/* The Problem & Solution */}
      <section className="py-20 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">The 2026 Paradigm Shift</h2>
              <p className="text-slate-600 mb-4 text-lg leading-relaxed">
                Financial journalism is no longer just about reporting numbers; it is about deciphering complex market forces and holding institutions accountable through data-driven transparency.
              </p>
              <p className="text-slate-600 text-lg leading-relaxed">
                The Journalist&apos;s Alpha Copilot addresses the fragmented and paywalled nature of Indian market data by prioritizing high-fidelity sources, offering real-time semantic synthesis and structured historical depth.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <Zap className="w-10 h-10 text-amber-500 mb-4" />
                <h3 className="font-bold text-xl mb-2">225x Speedup</h3>
                <p className="text-slate-600 text-sm">Reduce insider buy research from 35 minutes to 8 seconds.</p>
              </div>
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <ShieldCheck className="w-10 h-10 text-emerald-500 mb-4" />
                <h3 className="font-bold text-xl mb-2">SEBI Compliant</h3>
                <p className="text-slate-600 text-sm">Immutable audit trails and source-linked verification.</p>
              </div>
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <BarChart2 className="w-10 h-10 text-blue-500 mb-4" />
                <h3 className="font-bold text-xl mb-2">Quant Rigor</h3>
                <p className="text-slate-600 text-sm">Z-scores, Bayesian updating, and Walk-Forward validation.</p>
              </div>
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <BookOpen className="w-10 h-10 text-purple-500 mb-4" />
                <h3 className="font-bold text-xl mb-2">Plain English</h3>
                <p className="text-slate-600 text-sm">Translates complex technical patterns into journalist-ready leads.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Deep Dive: Quantitative Foundations */}
      <section id="architecture" className="py-24 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Hard Mathematics for Signal Detection</h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-lg">
              We deploy multiple layers of statistical screening to distinguish genuine informational signals from the noise of routine transactions.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Card 1 */}
            <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 hover:border-blue-500 transition-colors">
              <Database className="w-8 h-8 text-blue-400 mb-6" />
              <h3 className="text-xl font-bold mb-3">Z-Score Anomaly Detection</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">
                A promoter buying ₹2 Cr of stock is meaningless if their historical average is ₹1.8 Cr/month. It is explosive if their average is ₹0.05 Cr/month. We use Welford&apos;s Online Algorithm for numerically stable running statistics.
              </p>
              <div className="bg-slate-950 p-4 rounded-lg font-mono text-xs text-emerald-400 overflow-x-auto">
                Z = (V_t - μ) / σ <br/>
                Flag if Z ≥ 2.0 (α ≈ 0.023)
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 hover:border-purple-500 transition-colors">
              <Layers className="w-8 h-8 text-purple-400 mb-6" />
              <h3 className="text-xl font-bold mb-3">Bayesian Beta-Binomial Updating</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">
                The frequentist approach gives static win rates. Our Bayesian framework allows us to update beliefs in real-time as new pattern outcomes arrive, using James-Stein shrinkage to prevent overfitting on small samples.
              </p>
              <div className="bg-slate-950 p-4 rounded-lg font-mono text-xs text-purple-400 overflow-x-auto">
                Prior: p ~ Beta(α₀, β₀)<br/>
                Posterior: p | k, n ~ Beta(α₀+k, β₀+n-k)
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 hover:border-amber-500 transition-colors">
              <TrendingUp className="w-8 h-8 text-amber-400 mb-6" />
              <h3 className="text-xl font-bold mb-3">Hidden Markov Regime Detection</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">
                A bullish flag pattern that works 70% of the time in a bull market may work only 40% of the time in a bearish regime. We model the Nifty 50 using a 3-state HMM (Bull, Bear, Sideways) for regime-conditional validity.
              </p>
              <div className="bg-slate-950 p-4 rounded-lg font-mono text-xs text-amber-400 overflow-x-auto">
                r_t | State_t = j ~ N(μ_j, σ_j²)<br/>
                Inference via Viterbi algorithm
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The 75% Efficiency Benchmark */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-12">The 75% Efficiency Benchmark</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="p-4 font-semibold text-slate-700">Task</th>
                  <th className="p-4 font-semibold text-slate-700">Manual Time</th>
                  <th className="p-4 font-semibold text-slate-700">Agent Time</th>
                  <th className="p-4 font-semibold text-slate-700">Speedup</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 text-slate-800 font-medium">Find today&apos;s insider buys</td>
                  <td className="p-4 text-slate-500">25–35 min</td>
                  <td className="p-4 text-emerald-600 font-bold">4–8 sec</td>
                  <td className="p-4 text-blue-600 font-bold">225×</td>
                </tr>
                <tr className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 text-slate-800 font-medium">Identify bulk deals</td>
                  <td className="p-4 text-slate-500">15–20 min</td>
                  <td className="p-4 text-emerald-600 font-bold">3–6 sec</td>
                  <td className="p-4 text-blue-600 font-bold">200×</td>
                </tr>
                <tr className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 text-slate-800 font-medium">Find chart breakouts</td>
                  <td className="p-4 text-slate-500">45–60 min</td>
                  <td className="p-4 text-emerald-600 font-bold">5–10 sec</td>
                  <td className="p-4 text-blue-600 font-bold">360×</td>
                </tr>
                <tr className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 text-slate-800 font-medium">Write story lead (draft)</td>
                  <td className="p-4 text-slate-500">20–30 min</td>
                  <td className="p-4 text-emerald-600 font-bold">8–15 sec</td>
                  <td className="p-4 text-blue-600 font-bold">100×</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-blue-600 text-white text-center">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-4xl font-bold mb-6">Ready to augment your reporting?</h2>
          <p className="text-blue-100 text-xl mb-10">
            Join the future of financial journalism. Stop scraping PDFs and start uncovering the real story.
          </p>
          <Link href={user ? "/chat" : "/login"} className="inline-block bg-white text-blue-600 hover:bg-slate-50 px-10 py-4 rounded-lg text-lg font-bold transition-all shadow-lg hover:shadow-xl">
            Access Alpha Copilot
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
