import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';

// /dashboard is a legacy stub. Authenticated users go to /settings (the real home).
export default async function DashboardStub() {
  const user = await getSessionUser();
  if (user) redirect('/settings');
  redirect('/login');
}
