import { NextResponse } from 'next/server';

export async function POST(request) {
  const SUPABASE_URL = 'https://rhsszirtbyvalugmbecm.supabase.co';
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    const body = await request.json();

    const {
      operator_id,
      experience_id,
      guest_name,
      guest_email,
      guest_phone,
      team_name,
      guest_count,
      booking_date,
      notes,
      total_amount,
    } = body;

    if (!operator_id || !guest_name || !guest_email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Insert booking
    const res = await fetch(`${SUPABASE_URL}/rest/v1/bookings`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        operator_id,
        experience_id: experience_id || null,
        guest_name,
        guest_email,
        guest_phone: guest_phone || '',
        team_name: team_name || '',
        guest_count: guest_count || 1,
        booking_date: booking_date || null,
        notes: notes || '',
        total_amount: total_amount || 0,
        payment_status: (total_amount && total_amount > 0) ? 'pending' : 'paid',
        status: 'pending',
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: data.message || 'Failed to create booking' }, { status: 400 });
    }

    const booking = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({ booking });

  } catch (error) {
    console.error('Booking error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
