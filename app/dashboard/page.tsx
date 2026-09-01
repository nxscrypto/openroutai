import Link from 'next/link';

export default function DashboardStub() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-[520px] w-full bg-surface hairline rounded-[14px] p-10 text-center">
        <div className="flex justify-center mb-6">
          <div className="w-7 h-7 rounded-full bg-logo-sphere shadow-logo-sphere" />
        </div>
        <h1 className="text-[22px] font-semibold mb-2">Dashboard coming next</h1>
        <p className="text-[14px] text-text-4 leading-[1.6]">
          The landing page is live. The full dashboard (Usage, Routing, API Keys, Credits, Payment) is next up. Auth is stubbed in this preview.
        </p>
        <Link
          href="/"
          className="inline-block mt-8 text-[14px] font-semibold text-bg bg-accent rounded-full px-7 py-3 shadow-btn-primary hover:bg-accent-hover transition-colors"
        >
          Back to landing
        </Link>
      </div>
    </main>
  );
}
