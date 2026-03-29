import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const SUPABASE_URL = 'https://rhsszirtbyvalugmbecm.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

export async function POST(request) {
  try {
    const { operator_id, tournament_id } = await request.json();

    if (!operator_id) {
      return NextResponse.json({ error: 'Missing operator_id' }, { status: 400 });
    }

    // Get operator info
    const opRes = await fetch(`${SUPABASE_URL}/rest/v1/operators?id=eq.${operator_id}&select=business_name,email,slug`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    const ops = await opRes.json();
    if (!ops || ops.length === 0) {
      return NextResponse.json({ error: 'Operator not found' }, { status: 404 });
    }
    const operator = ops[0];

    // Get tournament info if provided
    let tournamentName = 'Tournament Pro Unlock';
    if (tournament_id) {
      const tRes = await fetch(`${SUPABASE_URL}/rest/v1/tournaments?id=eq.${tournament_id}&select=name_en`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      const tournaments = await tRes.json();
      if (tournaments && tournaments.length > 0) {
        tournamentName = tournaments[0].name_en || 'Tournament Pro Unlock';
      }
    }

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'GoStar Digital — Pro Tournament',
            description: tournamentName + ' — ' + (operator.business_name || 'Organizer')
          },
          unit_amount: 4900 // $49.00
        },
        quantity: 1
      }],
      customer_email: operator.email,
      metadata: {
        operator_id: operator_id,
        tournament_id: tournament_id || '',
        type: 'pro_unlock'
      },
      success_url: `https://gostar.digital/my-dashboard.html?pro=success&tid=${tournament_id || ''}`,
      cancel_url: `https://gostar.digital/my-dashboard.html?pro=cancelled`
    });

    return NextResponse.json({ url: session.url });

  } catch (error) {
    console.error('Unlock Pro error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
