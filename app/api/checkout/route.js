// app/api/checkout/route.js
// Stripe Checkout — creates session with 5% platform fee split to operator
// SELF-CONTAINED: no external imports from lib/

import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Supabase REST API
const SUPABASE_URL = 'https://rhsszirtbyvalugmbecm.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function supabaseGet(table, query) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  return res.json();
}

async function supabasePost(table, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(body)
  });
  return res.json();
}

export async function POST(request) {
  try {
    const { experience_id, team_name, guest_name, guest_email, guest_phone, guest_count } = await request.json();

    if (!experience_id || !team_name || !guest_email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get experience + operator info
    const experiences = await supabaseGet('experiences', `id=eq.${experience_id}&select=*,operators(id,slug,stripe_account_id,business_name)`);

    if (!experiences || experiences.length === 0) {
      return NextResponse.json({ error: 'Experience not found' }, { status: 404 });
    }

    const experience = experiences[0];
    const operator = experience.operators;

    if (!operator || !operator.stripe_account_id) {
      return NextResponse.json({ error: 'Operator has not connected payments' }, { status: 400 });
    }

    const count = guest_count || 1;
    const priceInCents = Math.round(experience.price_per_person * count * 100);
    const platformFee = Math.round(priceInCents * 0.05); // 5% platform fee

    // Create booking record in Supabase (pending payment)
    const bookings = await supabasePost('bookings', {
      experience_id: experience.id,
      operator_id: operator.id,
      team_name: team_name || '',
      guest_name,
      guest_email,
      guest_phone: guest_phone || '',
      guest_count: count,
      total_amount: experience.price_per_person * count,
      payment_status: 'pending',
      status: 'pending'
    });

    const booking = Array.isArray(bookings) ? bookings[0] : bookings;

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: experience.title_en,
            description: `${team_name} — ${operator.business_name}`
          },
          unit_amount: priceInCents
        },
        quantity: 1
      }],
      payment_intent_data: {
        application_fee_amount: platformFee,
        transfer_data: {
          destination: operator.stripe_account_id
        }
      },
      customer_email: guest_email,
      metadata: {
        booking_id: booking.id,
        operator_id: operator.id,
        experience_id: experience.id,
        team_name: team_name || ''
      },
      success_url: `https://hoops.money/${operator.slug}?booked=success&team=${encodeURIComponent(team_name || '')}`,
      cancel_url: `https://hoops.money/${operator.slug}?booked=cancelled`
    });

    return NextResponse.json({ url: session.url, booking_id: booking.id });

  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
