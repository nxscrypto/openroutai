import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { query } from '@/lib/db';

interface Card {
  stripe_payment_method_id: string;
  brand: string;
  last4: string;
  exp_month: number | null;
  exp_year: number | null;
  is_default: boolean;
  created_at: string;
}

export default async function BillingPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const cards = await query<Card>(
    `SELECT stripe_payment_method_id, brand, last4, exp_month, exp_year, is_default, created_at
     FROM or_payment_methods WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC`,
    [user.id]
  );

  return (
    <div>
      <h1 className="text-[26px] font-semibold mb-4">Billing</h1>
      <p>Cards on file: {cards.rows.length}</p>
    </div>
  );
}
