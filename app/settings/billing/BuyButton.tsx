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
        // 'manual' so fetch returns the 307 response WITHOUT following the
        // cross-origin redirect to checkout.stripe.com. Without this, the
        // browser fails to read the cross-origin response and throws
        // "TypeError: Load failed".
        redirect: 'manual',
      });

      // res.type === 'opaqueredirect' when fetch got a redirect it can't follow
      // (because redirect: 'manual' was set on a non-GET response). We need to
      // read the Location header from the original response.
      if (res.type === 'opaqueredirect') {
        // We can't read the Location header from an opaque redirect — but
        // our API also returns JSON if we ask for it.
        // Fallback: re-request with Accept: application/json.
        const jsonRes = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({ price_id: priceId }),
          redirect: 'follow',
        });
        if (jsonRes.ok) {
          const data = await jsonRes.json();
          if (data.url) {
            window.location.href = data.url;
            return;
          }
        }
        setError('Could not get checkout URL');
        setLoading(false);
        return;
      }

      if (res.redirected) {
        window.location.href = res.url;
        return;
      }

      // Direct JSON response
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
          return;
        }
      }
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || data.detail || `Server error ${res.status}`);
      } else {
        setError(`Server returned HTTP ${res.status}`);
      }
    } catch (e) {
      setError(`Network error: ${(e as Error).message || 'request failed'}`);
    } finally {
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
      {error && <span className="text-[11px] text-[#ff8585] max-w-[200px] text-right">{error}</span>}
    </div>
  );
}
