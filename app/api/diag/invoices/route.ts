import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getStripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const stripe = getStripe();

    // Try to find all customers with the given email
    const url = new URL(req.url);
    const email = url.searchParams.get('email');
    if (!email) {
      return NextResponse.json({ error: 'email query param required' }, { status: 400 });
    }

    const byEmail = await stripe.customers.list({ email, limit: 20 });
    const byMeta = await stripe.customers.search({
      query: `email:'${email}'`,
      limit: 20,
    });

    const allCustomers: Record<string, any> = {};
    for (const c of byEmail.data) {
      allCustomers[c.id] = { ...c, invoices: [] };
    }
    for (const c of byMeta.data) {
      if (!allCustomers[c.id]) allCustomers[c.id] = { ...c, invoices: [] };
    }

    // Pull invoices for each customer
    for (const id of Object.keys(allCustomers)) {
      const invs = await stripe.invoices.list({ customer: id, limit: 20 });
      allCustomers[id].invoices = invs.data.map((i: any) => ({
        id: i.id,
        number: i.number,
        status: i.status,
        amount_due: i.amount_due,
        amount_paid: i.amount_paid,
        created: i.created,
      }));
    }

    return NextResponse.json({
      email,
      customer_count: Object.keys(allCustomers).length,
      customers: Object.values(allCustomers).map((c: any) => ({
        id: c.id,
        created: c.created,
        metadata: c.metadata,
        invoice_count: c.invoices?.length || 0,
        invoices: c.invoices,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
