import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request) {
  const SUPABASE_URL = 'https://xdlmajajjnsnipsapmls.supabase.co';
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://bookd.click';

  try {
    const { booking_id, operator_id, experience_title, amount, guest_email } = await request.json();

    if (!booking_id || !operator_id || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch operator to get Square credentials
    const opRes = await fetch(`${SUPABASE_URL}/rest/v1/operators?id=eq.${operator_id}&select=square_access_token,square_location_id,slug`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });
    const operators = await opRes.json();
    if (!operators || operators.length === 0 || !operators[0].square_access_token) {
      return NextResponse.json({ error: 'Operator has no Square account connected' }, { status: 400 });
    }

    const squareToken = operators[0].square_access_token;
    const locationId = operators[0].square_location_id;
    const slug = operators[0].slug || '';

    // Calculate amounts in cents
    const amountCents = Math.round(amount * 100);
    const appFeeCents = Math.round(amountCents * 0.05); // 5% platform fee

    const idempotencyKey = crypto.randomUUID();

    // Create Square Checkout using the Checkout API
    const checkoutRes = await fetch(`https://connect.squareup.com/v2/online-checkout/payment-links`, {
      method: 'POST',
      headers: {
        'Square-Version': '2025-01-23',
        'Authorization': `Bearer ${squareToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        idempotency_key: idempotencyKey,
        quick_pay: {
          name: experience_title || 'Event Registration',
          price_money: {
            amount: amountCents,
            currency: 'USD',
          },
          location_id: locationId,
        },
        checkout_options: {
          app_fee_money: {
            amount: appFeeCents,
            currency: 'USD',
          },
          redirect_url: `${APP_URL}/${slug}?payment=success&booking=${booking_id}`,
        },
        payment_note: `Bookd Registration - ${experience_title || 'Event'}`,
      }),
    });

    const checkoutData = await checkoutRes.json();

    if (!checkoutRes.ok || !checkoutData.payment_link) {
      console.error('Square checkout failed:', checkoutData);
      return NextResponse.json({ error: checkoutData.errors?.[0]?.detail || 'Checkout creation failed' }, { status: 400 });
    }

    const checkoutUrl = checkoutData.payment_link.url;
    const orderId = checkoutData.payment_link.order_id;

    // Update booking with Square order ID
    await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${booking_id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ stripe_session_id: orderId }), // reuse field for Square order ID
    });

    return NextResponse.json({ url: checkoutUrl });

  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
