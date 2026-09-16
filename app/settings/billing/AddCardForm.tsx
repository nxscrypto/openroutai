'use client';

export default function AddCardForm({ onAdded }: { onAdded: () => void }) {
  return (
    <div>
      <button onClick={onAdded}>Save card (test)</button>
    </div>
  );
}
