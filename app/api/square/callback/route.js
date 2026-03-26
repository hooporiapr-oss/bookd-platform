import { NextResponse } from 'next/server';

export async function GET(request) {
  const SQUARE_APP_ID = process.env.SQUARE_APPLICATION_ID;
  const SQUARE_SECRET = process.env.SQUARE_APPLICATION_SECRET;
  const SUPABASE_URL = 'https://xdlmajajjnsnipsapmls.supabase.co';
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://bookd.click';

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // operator_id
    const error = searchParams.get('error');

    // If seller denied access
    if (error) {
      return NextResponse.redirect(`${APP_URL}/my-dashboard.html?payments=denied`);
    }

    if (!code || !state) {
      return NextResponse.redirect(`${APP_URL}/my-dashboard.html?payments=error`);
    }

    const operatorId = decodeURIComponent(state);

    // Exchange authorization code for access token
    const tokenRes = await fetch('https://connect.squareup.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Square-Version': '2025-01-23',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: SQUARE_APP_ID,
        client_secret: SQUARE_SECRET,
        code: code,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('Square token exchange failed:', tokenData);
      return NextResponse.redirect(`${APP_URL}/my-dashboard.html?payments=error`);
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const merchantId = tokenData.merchant_id;
    const expiresAt = tokenData.expires_at;

    // Get merchant info
    const merchantRes = await fetch('https://connect.squareup.com/v2/merchants/me', {
      headers: {
        'Square-Version': '2025-01-23',
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    const merchantData = await merchantRes.json();
    const locationId = merchantData.merchant?.main_location_id || '';

    // Save Square credentials to operator record in Supabase
    await fetch(`${SUPABASE_URL}/rest/v1/operators?id=eq.${operatorId}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        square_merchant_id: merchantId,
        square_access_token: accessToken,
        square_refresh_token: refreshToken,
        square_location_id: locationId,
        square_token_expires: expiresAt,
        stripe_account_id: null, // clear any old stripe data
      }),
    });

    // Redirect back to dashboard with success
    return NextResponse.redirect(`${APP_URL}/my-dashboard.html?payments=connected`);

  } catch (error) {
    console.error('Square callback error:', error);
    return NextResponse.redirect(`${APP_URL}/my-dashboard.html?payments=error`);
  }
}
