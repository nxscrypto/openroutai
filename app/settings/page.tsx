import { getSessionUser } from '@/lib/auth';

export default async function SettingsAccountPage() {
  const user = await getSessionUser();
  if (!user) return null;

  return (
    <div className="max-w-[640px]">
      <h1 className="text-[26px] font-semibold mb-1">Account</h1>
      <p className="text-[13.5px] text-text-4 mb-8">Your profile and sign-in details.</p>

      <div className="bg-surface hairline rounded-[14px] p-7 space-y-5">
        <Row label="Name" value={user.name ?? '—'} />
        <Row label="Email" value={user.email} />
        <Row label="Email verified" value={user.email_verified ? 'Yes' : 'Not yet'} />
        <Row label="Open Rout AI user ID" value={user.id} mono />
        <Row label="Stripe customer" value={user.stripe_customer_id ?? 'Not created yet'} mono />
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 pb-4 border-b border-border last:border-0 last:pb-0">
      <div className="text-[11px] uppercase tracking-[0.16em] text-text-4">{label}</div>
      <div className={`text-[13.5px] text-text text-right ${mono ? 'font-mono text-[12px]' : ''}`}>{value}</div>
    </div>
  );
}
