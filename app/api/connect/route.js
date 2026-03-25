import { NextResponse } from 'next/server';

export async function POST(request) {
  // SELF-CONTAINED — no imports from lib/
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  const SUPABASE_URL = 'https://xdlmajajjnsnipsapmls.supabase.co';
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://bookd.click';

  if (!STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }

  try {
    const { operator_id } = await request.json();
    if (!operator_id) {
      return NextResponse.json({ error: 'Missing operator_id' }, { status: 400 });
    }

    // Fetch operator from Supabase
    const opRes = await fetch(`${SUPABASE_URL}/rest/v1/operators?id=eq.${operator_id}&select=*`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });
    const operators = await opRes.json();
    if (!operators || operators.length === 0) {
      return NextResponse.json({ error: 'Operator not found' }, { status: 404 });
    }
    const operator = operators[0];

    let stripeAccountId = operator.stripe_account_id;

    // Create Stripe Express account if none exists
    if (!stripeAccountId) {
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(STRIPE_SECRET_KEY);

      const account = await stripe.accounts.create({
        type: 'express',
        email: operator.email,
        business_profile: {
          name: operator.business_name,
          url: `${APP_URL}/${operator.slug}`,
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });

      stripeAccountId = account.id;

      // Save stripe_account_id to Supabase
      await fetch(`${SUPABASE_URL}/rest/v1/operators?id=eq.${operator_id}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ stripe_account_id: stripeAccountId }),
      });
    }

    // Create onboarding link
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(STRIPE_SECRET_KEY);

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${APP_URL}/my-dashboard.html`,
      return_url: `${APP_URL}/my-dashboard.html`,
      type: 'account_onboarding',
    });

    return NextResponse.json({ url: accountLink.url });

  } catch (error) {
    console.error('Connect error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
