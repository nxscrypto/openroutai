import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';

export default async function BillingPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  return (
    <div>
      <h1 className="text-[26px] font-semibold mb-4">Billing</h1>
      <p>Hello {user.email}, your account is active.</p>
    </div>
  );
}
