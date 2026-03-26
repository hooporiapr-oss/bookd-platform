import { NextResponse } from 'next/server';

export async function POST(request) {
  const SQUARE_APP_ID = process.env.SQUARE_APPLICATION_ID;
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://bookd.click';

  if (!SQUARE_APP_ID) {
    return NextResponse.json({ error: 'Square not configured' }, { status: 500 });
  }

  try {
    const { operator_id } = await request.json();
    if (!operator_id) {
      return NextResponse.json({ error: 'Missing operator_id' }, { status: 400 });
    }

    // Build Square OAuth authorization URL
    const scopes = [
      'PAYMENTS_WRITE',
      'PAYMENTS_READ',
      'PAYMENTS_WRITE_ADDITIONAL_RECIPIENTS',
      'MERCHANT_PROFILE_READ',
      'ORDERS_WRITE',
      'ORDERS_READ'
    ].join('+');

    const state = encodeURIComponent(operator_id);
    const redirectUri = encodeURIComponent(`${APP_URL}/api/square/callback`);

    const authUrl = `https://connect.squareup.com/oauth2/authorize?client_id=${SQUARE_APP_ID}&scope=${scopes}&session=false&state=${state}&redirect_uri=${redirectUri}`;

    return NextResponse.json({ url: authUrl });

  } catch (error) {
    console.error('Connect error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
