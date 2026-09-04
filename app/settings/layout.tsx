import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border bg-surface/60 backdrop-blur">
        <div className="max-w-[1080px] mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-logo-sphere shadow-logo-sphere" />
            <span className="text-[14px] font-semibold text-text">Open Rout AI</span>
          </Link>
          <nav className="flex items-center gap-5">
            <Link href="/settings" className="text-[13px] text-text-3 hover:text-text">Settings</Link>
            <Link href="/settings/billing" className="text-[13px] text-text-3 hover:text-text">Billing</Link>
            <Link href="/settings/api-keys" className="text-[13px] text-text-3 hover:text-text">API Keys</Link>
            <span className="text-[12px] text-text-4">{user.email}</span>
            <form action="/api/auth/logout" method="POST">
              <button type="submit" className="text-[12px] text-text-4 hover:text-text border border-border rounded-full px-3 py-1.5">Log out</button>
            </form>
          </nav>
        </div>
      </header>
      <main className="max-w-[1080px] mx-auto px-6 py-10">
        {children}
      </main>
    </div>
  );
}
