'use client';

import { useState } from 'react';
import HeroCanvas from '@/components/HeroCanvas';

// Copy from the README — final and approved, keep verbatim.
const SERVICES = [
  {
    no: '01',
    title: 'Agent building',
    body: 'Task-scoped agents with tools, memory, and evaluation harnesses that keep behavior stable in production.',
  },
  {
    no: '02',
    title: 'LLM routing',
    body: 'One endpoint across providers. Cost, latency, and quality budgets decide which model answers.',
  },
  {
    no: '03',
    title: 'Software building',
    body: 'Full applications around the model layer: interfaces, pipelines, and services your team owns.',
  },
  {
    no: '04',
    title: 'Business integration',
    body: 'Compatibility review of your current stack, then the connectors and guardrails to make AI fit it.',
  },
];

const ROUTING_POINTS = [
  'Automatic failover across providers and regions.',
  'Per-request cost ceilings and latency targets.',
  'Full request logs, traces, and spend attribution.',
];

const TICKER_ITEMS = [
  'Anthropic', 'OpenAI', 'Google', 'Meta', 'Mistral', 'xAI',
  'DeepSeek', 'Cohere', 'Amazon Bedrock', 'Azure AI', 'Together', 'Groq',
];

export default function LandingPage() {
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signup' | 'signin'>('signup');

  const openAuth = (mode: 'signup' | 'signin' = 'signup') => {
    setAuthMode(mode);
    setAuthOpen(true);
  };

  return (
    <main style={{ minHeight: '100vh', overflowX: 'hidden', background: 'radial-gradient(120% 80% at 70% -10%, #10160f 0%, #07080a 55%, #07080a 100%)' }}>
      {/* HERO CANVAS */}
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[860px] overflow-hidden pointer-events-none">
        <HeroCanvas />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(7,8,10,0) 55%, #07080a 100%)' }} />
      </div>

      {/* HEADER */}
      <header className="relative max-w-site mx-auto flex items-center justify-between gap-6 px-12 py-7">
        <div className="flex items-center gap-3">
          <div className="relative w-[26px] h-[26px] rounded-full bg-logo-sphere shadow-logo-sphere" />
          <span className="text-[17px] font-semibold tracking-[-0.01em]">Open Rout AI</span>
        </div>
        <nav className="flex items-center gap-[34px] text-[14px] text-text-3">
          <a href="#services" className="hover:text-text transition-colors">Services</a>
          <a href="#routing"  className="hover:text-text transition-colors">Routing</a>
          <a href="#models"   className="hover:text-text transition-colors">Models</a>
          <button
            onClick={() => openAuth('signup')}
            className="font-sans text-[14px] font-semibold text-bg bg-accent border-0 rounded-full px-[22px] py-[11px] cursor-pointer shadow-btn-nav hover:bg-accent-hover transition-colors"
          >
            Sign up / Sign in
          </button>
        </nav>
      </header>

      {/* HERO CONTENT */}
      <section className="relative max-w-site mx-auto px-12 pt-[120px]">
        <h1
          className="m-0 font-medium tracking-[-0.035em] max-w-[15ch]"
          style={{ fontSize: '78px', lineHeight: 0.98, textWrap: 'balance' }}
        >
          Every Agent. One Route.
        </h1>
        <p
          className="mt-[26px] max-w-[52ch] text-text-3 text-text-3 text-[19px] leading-[1.6] text-wrap-pretty"
        >
          Open Rout AI builds the agents, routing, and software that make AI usable inside a real business. We handle model selection, integration, and the plumbing underneath it.
        </p>
        <div className="flex items-center gap-5 mt-10">
          <button
            onClick={() => openAuth('signup')}
            className="font-sans text-[16px] font-semibold text-bg bg-accent border-0 rounded-full px-8 py-4 cursor-pointer shadow-btn-primary hover:bg-accent-hover transition-colors"
          >
            Sign up / Sign in
          </button>
        </div>
        <div className="h-[200px]" />
      </section>

      {/* SERVICES */}
      <section id="services" className="relative max-w-site mx-auto px-12 pt-10">
        <div className="eyebrow">What we do</div>
        <div className="grid grid-cols-4 gap-px mt-7 bg-white/[0.07] border border-white/[0.07] rounded-[14px] overflow-hidden">
          {SERVICES.map((s) => (
            <div
              key={s.no}
              className="bg-surface px-[26px] pt-[30px] pb-[34px] min-h-[230px] flex flex-col hover:bg-card-hover transition-colors"
            >
              <div className="font-mono text-[11px] text-accent">{s.no}</div>
              <div className="mt-[22px] text-[19px] font-semibold tracking-[-0.01em]">{s.title}</div>
              <p className="mt-3 text-[14px] leading-[1.6] text-text-4 text-wrap-pretty">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ROUTING */}
      <section id="routing" className="relative max-w-site mx-auto px-12 pt-[120px] grid grid-cols-2 gap-20 items-center">
        <div>
          <div className="eyebrow">Routing</div>
          <h2 className="mt-[22px] text-[44px] leading-[1.05] font-medium tracking-[-0.03em] max-w-[20ch]">
            Requests find the cheapest model that can still do the job.
          </h2>
          <p className="mt-[22px] text-[17px] leading-[1.65] text-text-3 max-w-[46ch] text-wrap-pretty">
            One endpoint in front of every provider. Classifiers score each request, the router picks a model, and failover happens before your users notice.
          </p>
          <div className="grid gap-[14px] mt-[34px]">
            {ROUTING_POINTS.map((p, i) => (
              <div key={i} className="flex items-baseline gap-[14px] text-[15px] text-text-2">
                <span className="w-[6px] h-[6px] rounded-full bg-accent flex-none" style={{ transform: 'translateY(-3px)' }} />
                {p}
              </div>
            ))}
          </div>
        </div>

        {/* CSS-only sphere */}
        <div
          aria-hidden="true"
          className="relative aspect-square w-full animate-float-y"
        >
          <div
            className="absolute inset-[12%] rounded-full shadow-routing-sphere"
            style={{ background: 'radial-gradient(circle at 34% 26%, rgba(234,255,160,.9), rgba(214,244,58,.22) 40%, rgba(20,28,12,.9) 72%, rgba(7,8,10,.95) 100%)' }}
          />
          {/* inner ring + top accent dot */}
          <div className="absolute inset-0 rounded-full border border-accent/20 animate-orb-spin" style={{ boxShadow: '0 0 120px rgba(214,244,58,.18)' }}>
            <span className="absolute left-1/2 -top-[4px] -translate-x-1/2 block w-2 h-2 rounded-full bg-accent" style={{ boxShadow: '0 0 16px rgba(214,244,58,.8)' }} />
          </div>
          {/* outer ring + cool dot */}
          <div className="absolute -inset-[8%] rounded-full border border-white/10 rotate-[24deg] animate-orb-spin" style={{ animationDirection: 'reverse', animationDuration: '44s' }}>
            <span className="absolute right-[6%] bottom-[6%] block w-1.5 h-1.5 rounded-full bg-accent-cool" style={{ boxShadow: '0 0 12px rgba(127,214,255,.8)' }} />
          </div>
        </div>
      </section>

      {/* PROVIDER TICKER */}
      <section id="models" className="relative mt-[120px] border-y hairline overflow-hidden">
        <div className="py-[22px] flex w-max gap-14 animate-ticker font-mono text-[12px] tracking-[.1em] uppercase text-text-6">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((name, i) => (
            <span key={i}>{name}</span>
          ))}
        </div>
      </section>

      {/* CLOSING CTA */}
      <section className="max-w-site mx-auto px-12 py-[130px] text-center">
        <h2 className="text-[52px] leading-[1.05] font-medium tracking-[-0.03em] max-w-[20ch] mx-auto">
          Route your first request today.
        </h2>
        <p className="mt-[22px] text-[17px] leading-[1.65] text-text-3 max-w-[44ch] mx-auto text-wrap-pretty">
          Create an account, add credits, and point your existing SDK at one endpoint.
        </p>
        <div className="mt-10">
          <button
            onClick={() => openAuth('signup')}
            className="font-sans text-[16px] font-semibold text-bg bg-accent border-0 rounded-full px-[34px] py-4 cursor-pointer shadow-btn-primary hover:bg-accent-hover transition-colors"
          >
            Sign up / Sign in
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t hairline py-7 px-12 flex items-center justify-between font-mono text-[11px] tracking-[.06em] uppercase text-text-7">
        <span>Open Rout AI</span>
        <a href="mailto:hello@openrout.ai" className="hover:text-text transition-colors">hello@openrout.ai</a>
      </footer>

      {/* AUTH MODAL */}
      {authOpen && <AuthModal mode={authMode} setMode={setAuthMode} onClose={() => setAuthOpen(false)} />}
    </main>
  );
}

/* ============================================================ AUTH MODAL */
function AuthModal({
  mode,
  setMode,
  onClose,
}: {
  mode: 'signup' | 'signin';
  setMode: (m: 'signup' | 'signin') => void;
  onClose: () => void;
}) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center px-5 backdrop-blur-md"
      style={{ background: 'rgba(4,5,6,.78)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] bg-surface hairline-strong rounded-[18px] px-8 pt-[34px] pb-[30px] shadow-modal animate-rise"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded-full bg-logo-sphere shadow-logo-sphere" />
            <span className="text-[15px] font-semibold">Open Rout AI</span>
          </div>
          <button onClick={onClose} aria-label="Close" className="bg-transparent border-0 text-text-5 hover:text-text text-lg leading-none cursor-pointer">×</button>
        </div>

        {/* Segmented control */}
        <div className="flex gap-1 p-1 bg-surface-input rounded-full mb-4">
          {(['signup', 'signin'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 text-[13px] font-semibold rounded-full py-[10px] transition-colors ${mode === m ? 'bg-accent text-bg' : 'bg-transparent text-text-4 hover:text-text'}`}
            >
              {m === 'signup' ? 'Sign up' : 'Sign in'}
            </button>
          ))}
        </div>

        <div className="grid gap-3">
          <input
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-surface-input text-text text-[14px] hairline-strong rounded-[10px] px-[14px] py-[13px] outline-none focus:border-accent/55 placeholder:text-text-5"
          />
          <input
            type="password"
            placeholder="Password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="bg-surface-input text-text text-[14px] hairline-strong rounded-[10px] px-[14px] py-[13px] outline-none focus:border-accent/55 placeholder:text-text-5"
          />
        </div>

        <button
          className="mt-5 w-full text-[15px] font-semibold bg-accent text-bg rounded-[10px] py-[14px] hover:bg-accent-hover transition-colors"
          onClick={() => {
            // stub: production wiring (Auth.js / Clerk / Supabase) goes here.
            window.location.href = '/dashboard';
          }}
        >
          {mode === 'signup' ? 'Create account' : 'Continue'}
        </button>

        <div className="text-center mt-4 text-[12px] text-text-6">Single sign-on available on enterprise plans.</div>
      </div>
    </div>
  );
}
