import { NextResponse } from 'next/server';

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Known paths — pass through normally
  const knownPaths = [
    '/',
    '/index.html',
    '/signup.html',
    '/login.html',
    '/my-dashboard.html',
    '/operator.html',
    '/scouts.html',
    '/privacy.html',
    '/terms.html',
  ];

  // Pass through known pages, API routes, static files, Next internals
  if (
    knownPaths.includes(pathname) ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|css|js|webp|woff|woff2|ttf|json)$/)
  ) {
    return NextResponse.next();
  }

  // Everything else is an operator slug → rewrite to operator.html
  const url = request.nextUrl.clone();
  url.pathname = '/operator.html';
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
