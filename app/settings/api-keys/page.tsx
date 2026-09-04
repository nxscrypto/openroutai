import { getSessionUser } from '@/lib/auth';

export default async function ApiKeysPage() {
  const user = await getSessionUser();
  if (!user) return null;

  return (
    <div className="max-w-[760px]">
      <h1 className="text-[26px] font-semibold mb-1">API Keys</h1>
      <p className="text-[13.5px] text-text-4 mb-8">Manage keys for routing your agents.</p>

      <div className="bg-surface hairline rounded-[14px] p-7">
        <div className="text-[13px] text-text-3">
          API key generation ships next. Once you have a card on file in{' '}
          <a href="/settings/billing" className="text-accent hover:underline">Billing</a>,
          you can mint keys for your own agents to route through Open Rout AI.
        </div>
      </div>
    </div>
  );
}
