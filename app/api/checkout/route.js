import { NextResponse } from 'next/server';

export async function POST(request) {
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  const SUPABASE_URL = 'https://xdlmajajjnsnipsapmls.supabase.co';
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://bookd.click';

  if (!STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }

  try {
    const { booking_id, operator_id, experience_title, amount, guest_email } = await request.json();

    if (!booking_id || !operator_id || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch operator to get stripe_account_id
    const opRes = await fetch(`${SUPABASE_URL}/rest/v1/operators?id=eq.${operator_id}&select=stripe_account_id,slug`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });
    const operators = await opRes.json();
    if (!operators || operators.length === 0 || !operators[0].stripe_account_id) {
      return NextResponse.json({ error: 'Operator has no Stripe account connected' }, { status: 400 });
    }

    const stripeAccountId = operators[0].stripe_account_id;
    const slug = operators[0].slug || '';

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(STRIPE_SECRET_KEY);

    // Calculate 5% platform fee in cents
    const amountCents = Math.round(amount * 100);
    const platformFee = Math.round(amountCents * 0.05);

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: guest_email || undefined,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: experience_title || 'Event Registration',
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: platformFee,
        transfer_data: {
          destination: stripeAccountId,
        },
      },
      success_url: `${APP_URL}/${slug}?payment=success&booking=${booking_id}`,
      cancel_url: `${APP_URL}/${slug}?payment=cancelled`,
      metadata: {
        booking_id: booking_id,
        operator_id: operator_id,
      },
    });

    // Update booking with stripe session id
    await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${booking_id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ stripe_session_id: session.id }),
    });

    return NextResponse.json({ url: session.url });

  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
