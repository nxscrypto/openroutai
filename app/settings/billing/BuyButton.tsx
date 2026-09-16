'use client';

import { useState } from 'react';

export default function BuyButton({
  priceId,
  label,
}: {
  priceId: string;
  label: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price_id: priceId }),
      });
      if (res.redirected) {
        // API returned a 307 — follow it
        window.location.href = res.url;
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Error ${res.status}`);
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError('No checkout URL returned');
        setLoading(false);
      }
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
        className="text-[12.5px] font-semibold text-bg bg-accent rounded-full px-4 py-2 shadow-btn-primary hover:bg-accent-hover disabled:opacity-50 transition-colors"
      >
        {loading ? 'Loading…' : label}
      </button>
      {error && <span className="text-[11px] text-[#ff8585]">{error}</span>}
    </div>
  );
}
