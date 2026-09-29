'use client';

import { useState } from 'react';

export default function SetDefaultCardButton({
  paymentMethodId,
  isDefault,
}: {
  paymentMethodId: string;
  isDefault: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (isDefault) {
    return (
      <span className="text-[10.5px] uppercase tracking-[0.16em] text-accent">
        Default
      </span>
    );
  }

  const handleClick = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/set-default-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_method_id: paymentMethodId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `Error ${res.status}`);
        setLoading(false);
        return;
      }
      // Reload the page to refresh the card list
      window.location.reload();
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={loading}
        className="text-[11px] text-text-2 hover:text-text border border-border rounded-full px-3 py-1.5 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Saving…' : 'Set as default'}
      </button>
      {error && <span className="text-[10.5px] text-[#ff8585]">{error}</span>}
    </div>
  );
}
