'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const r = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErr(j.error || 'Sign-up failed');
      } else {
        router.push('/settings');
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-bg">
      <div className="max-w-[420px] w-full bg-surface hairline rounded-[14px] p-10">
        <div className="flex justify-center mb-6">
          <div className="w-7 h-7 rounded-full bg-logo-sphere shadow-logo-sphere" />
        </div>
        <h1 className="text-[22px] font-semibold mb-1 text-center">Create your account</h1>
        <p className="text-[13px] text-text-4 text-center mb-7">Start routing your agents through Open Rout AI.</p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-[11px] uppercase tracking-[0.16em] text-text-4 mb-1.5">Name</label>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              autoComplete="name" placeholder="Brent Campbell"
              className="w-full bg-card-alt hairline rounded-[9px] px-3.5 py-2.5 text-[14px] text-text focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-[0.16em] text-text-4 mb-1.5">Email</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              autoComplete="email" placeholder="you@company.com"
              className="w-full bg-card-alt hairline rounded-[9px] px-3.5 py-2.5 text-[14px] text-text focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-[0.16em] text-text-4 mb-1.5">Password</label>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
              autoComplete="new-password" placeholder="Min 8 characters"
              className="w-full bg-card-alt hairline rounded-[9px] px-3.5 py-2.5 text-[14px] text-text focus:outline-none focus:border-accent"
            />
          </div>

          {err && <div className="text-[13px] text-[#ff8a80] bg-[#3a1717] rounded-[8px] px-3 py-2">{err}</div>}

          <button
            type="submit" disabled={busy}
            className="w-full text-[14px] font-semibold text-bg bg-accent rounded-full px-7 py-3 shadow-btn-primary hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {busy ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="text-[12.5px] text-text-4 text-center mt-6">
          Already have an account? <Link href="/login" className="text-accent hover:underline">Log in</Link>
        </p>
      </div>
    </main>
  );
}
