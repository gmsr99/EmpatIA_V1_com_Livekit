import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') ?? '';
  const { pathname } = request.nextUrl;

  // Skip Next.js internals, static assets, and NextAuth callbacks
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/favicon.ico' ||
    pathname === '/apple-icon.png' ||
    pathname === '/icon.png'
  ) {
    return NextResponse.next();
  }

  // agente.empatia-portugal.pt → serve /agente page at root
  if (hostname.startsWith('agente.') && pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/agente';
    return NextResponse.rewrite(url);
  }

  // cuidadores.empatia-portugal.pt → /cuidador/*
  if (hostname.startsWith('cuidadores.')) {
    const url = request.nextUrl.clone();
    if (pathname === '/') {
      url.pathname = '/cuidador';
      return NextResponse.rewrite(url);
    }
    // Map /[patientId] → /cuidador/[patientId] (patient detail pages)
    if (
      !pathname.startsWith('/cuidador') &&
      !pathname.startsWith('/login') &&
      !pathname.startsWith('/register') &&
      !pathname.startsWith('/api') &&
      !pathname.startsWith('/dashboard')
    ) {
      url.pathname = '/cuidador' + pathname;
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
