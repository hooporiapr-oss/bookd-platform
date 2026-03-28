// app/api/connect/route.js
// Stripe Connect onboarding — generates link for operators to connect bank accounts
// SELF-CONTAINED: no external imports from lib/

import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Supabase REST API (no SDK needed)
const SUPABASE_URL = 'https://xdlmajajjnsnipsapmls.supabase.co';
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

export async function POST(request) {
  try {
    const { operator_id } = await request.json();

    if (!operator_id) {
      return NextResponse.json({ error: 'Missing operator_id' }, { status: 400 });
    }

    // Check if operator already has a Stripe account
    const operators = await supabaseGet('operators', `id=eq.${operator_id}&select=stripe_account_id,business_name`);
    
    if (!operators || operators.length === 0) {
      return NextResponse.json({ error: 'Operator not found' }, { status: 404 });
    }

    const operator = operators[0];
    let stripeAccountId = operator.stripe_account_id;

    // Create new Stripe Connect account if none exists
    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'US',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true }
        },
        business_profile: {
          name: operator.business_name || 'Hoops Money Operator'
        }
      });

      stripeAccountId = account.id;

      // Save to Supabase
      await supabasePatch('operators', `id=eq.${operator_id}`, {
        stripe_account_id: stripeAccountId
      });
    }

    // Generate onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: 'https://hoops.money/my-dashboard.html?stripe=refresh',
      return_url: 'https://hoops.money/my-dashboard.html?stripe=success',
      type: 'account_onboarding'
    });

    return NextResponse.json({ url: accountLink.url });

  } catch (error) {
    console.error('Connect error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
