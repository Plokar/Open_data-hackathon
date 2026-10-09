import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Middleware – ochrana chráněných rout
 *
 * Chráněné routy vyžadují JWT cookie. V produkci musí mít cookie doménu sdílenou
 * s API (AUTH_COOKIE_DOMAIN=.domena.cz), jinak ji proxy na www.* neuvidí (PROJECT_SPEC O1).
 * Pokud uživatel nemá JWT cookie → přesměrovat na /login
 */

const PROTECTED_PATHS = ['/pass', '/pets', '/battle', '/team'];
const AUTH_PATHS = ['/start', '/login', '/register', '/forgot-password', '/reset-password'];


/** Jen cesty v rámci aplikace, žádné přesměrování na cizí doménu. */
function safeRedirect(r: string | null) {
  return r && r.startsWith('/') && !r.startsWith('//') ? r : '/map';
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get('access_token');
  const isAuthenticated = !!accessToken;

  // Nepřihlášené z chráněných stránek poslat na onboarding (stačí jméno)
  const isProtected = PROTECTED_PATHS.some((path) =>
    pathname.startsWith(path),
  );
  if (isProtected && !isAuthenticated) {
    // Po onboardingu se vrátit, odkud přišel (např. pozvánka na souboj)
    const url = new URL('/start', request.url);
    url.searchParams.set('redirect', pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  // Přesměrovat přihlášené z auth stránek na mapu
  const isAuthPage = AUTH_PATHS.some((path) => pathname.startsWith(path));
  if (isAuthPage && isAuthenticated) {
    return NextResponse.redirect(new URL(safeRedirect(request.nextUrl.searchParams.get('redirect')), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Spustit middleware na všech cestách kromě:
     * - _next/static (statické soubory)
     * - _next/image (optimalizace obrázků)
     * - favicon.ico, public assets
     * - api routes
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api/).*)',
  ],
};
