import Link from 'next/link';

interface Receipt {
  id: string;
  number: string;
  amount_paid_cents: number;
  amount_due_cents: number;
  currency: string;
  status: string;
  description: string | null;
  created_at: string;
  paid_at: string | null;
  kind: string | null;
  recipient: string;
}

export const dynamic = 'force-dynamic';

async function getReceipt(id: string): Promise<Receipt | null> {
  const origin = process.env.NEXT_PUBLIC_APP_URL || 'https://openroutai.com';
  try {
    const res = await fetch(`${origin}/api/receipts/${id}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as Receipt;
  } catch {
    return null;
  }
}

export default async function ReceiptPage({ params }: { params: { id: string } }) {
  const receipt = await getReceipt(params.id);

  if (!receipt) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-6">
        <div className="max-w-[480px] bg-white border border-[#e8e8e8] rounded-2xl p-12 text-center shadow-sm">
          <h1 className="text-[24px] font-semibold text-[#111] mb-2">Receipt not found</h1>
          <p className="text-[14px] text-[#666]">This receipt may have expired or the link is incorrect.</p>
          <Link href="/" className="inline-block mt-6 text-[13px] text-[#7dd3a0] hover:underline">
            ← Back to Open Rout AI
          </Link>
        </div>
      </div>
    );
  }

  const amount = (receipt.amount_paid_cents || receipt.amount_due_cents) / 100;
  const cur = receipt.currency.toUpperCase();
  const isPaid = receipt.status === 'paid';
  const isRecurring = receipt.kind === 'subscription' || /subscription|month/i.test(receipt.description || '');
  const dateStr = receipt.paid_at || receipt.created_at;
  const dateFormatted = new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });

  return (
    <div className="min-h-screen bg-[#fafafa] py-10 px-6">
      <div className="max-w-[640px] mx-auto bg-white border border-[#e8e8e8] rounded-2xl shadow-sm overflow-hidden">

        {/* Header — Open Rout AI branding */}
        <div className="relative bg-black text-white p-10 overflow-hidden">
          <div className="absolute top-0 left-0 w-1/2 h-full bg-gradient-to-br from-[#7dd3a0]/20 to-transparent" />
          <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-bl from-white/10 to-transparent" />
          <div className="relative">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-7 h-7 rounded-full bg-[#7dd3a0] shadow-[0_0_20px_rgba(125,211,160,0.4)]" />
              <span className="text-[16px] font-semibold">Open Rout AI</span>
            </div>
            <h1 className="text-[28px] font-semibold mt-6">Receipt</h1>
            <p className="text-[13px] text-white/60 mt-1 font-mono">#{receipt.number}</p>
          </div>
        </div>

        {/* Body */}
        <div className="p-10">

          {/* Meta grid */}
          <div className="grid grid-cols-3 gap-6 mb-8">
            <div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-[#999] mb-1">Amount paid</div>
              <div className="text-[20px] font-semibold text-[#111] font-mono">${amount.toFixed(2)} {cur}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-[#999] mb-1">Date paid</div>
              <div className="text-[14px] text-[#333]">{dateFormatted}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-[#999] mb-1">Status</div>
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] uppercase tracking-[0.14em] px-1.5 py-0.5 rounded ${
                  isPaid ? 'bg-[#e6f7ed] text-[#1e7e3a]' : 'bg-[#fef4e5] text-[#a06a00]'
                }`}>
                  {receipt.status}
                </span>
                <span className="text-[10px] uppercase tracking-[0.14em] px-1.5 py-0.5 rounded bg-[#e8f0fa] text-[#2a5db0]">
                  {isRecurring ? 'Recurring' : 'One-time'}
                </span>
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="border-t border-b border-[#eee] py-5 mb-6">
            <div className="text-[10px] uppercase tracking-[0.16em] text-[#999] mb-3">Summary</div>
            <div className="bg-[#f7f7f7] rounded-xl p-5">
              <div className="flex justify-between items-baseline text-[14px] text-[#222]">
                <span>{receipt.description || 'Charge'}</span>
                <span className="font-mono">${amount.toFixed(2)}</span>
              </div>
              <div className="border-t border-[#e0e0e0] mt-3 pt-3 flex justify-between items-baseline font-semibold text-[14px] text-[#111]">
                <span>Amount paid</span>
                <span className="font-mono">${amount.toFixed(2)} {cur}</span>
              </div>
            </div>
          </div>

          {/* Recipient */}
          <div className="text-[12px] text-[#666] mb-2">
            <span className="text-[#999]">Billed to:</span> {receipt.recipient}
          </div>

          {/* Footer */}
          <div className="border-t border-[#eee] pt-6 mt-6 flex items-center justify-between">
            <Link href="/" className="text-[12px] text-[#7dd3a0] hover:underline">
              ← Open Rout AI
            </Link>
            <span className="text-[10.5px] text-[#999]">
              Powered by Open Rout AI · Powered by Stripe for payment processing
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
