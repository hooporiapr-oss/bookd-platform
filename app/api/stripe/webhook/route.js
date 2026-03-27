// app/api/stripe/webhook/route.js
// Stripe Webhook — handles payment confirmations and account updates
// SELF-CONTAINED: no external imports from lib/

import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Supabase REST API
const SUPABASE_URL = 'https://ixykmnvlmfnxpctrgvej.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function supabasePatch(table, query, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(body)
  });
  return res;
}

// Next.js App Router needs raw body for Stripe signature verification
export async function POST(request) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    let event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Handle events
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object;
        const bookingId = session.metadata?.booking_id;

        if (bookingId) {
          // Update booking payment status to paid
          await supabasePatch('bookings', `id=eq.${bookingId}`, {
            payment_status: 'paid',
            stripe_session_id: session.id
          });
          console.log(`Booking ${bookingId} marked as paid`);
        }
        break;
      }

      case 'account.updated': {
        const account = event.data.object;
        const stripeAccountId = account.id;

        // Check if charges are enabled — means operator is fully onboarded
        if (account.charges_enabled) {
          await supabasePatch('operators', `stripe_account_id=eq.${stripeAccountId}`, {
            stripe_charges_enabled: true
          });
          console.log(`Operator with Stripe ${stripeAccountId} — charges enabled`);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
