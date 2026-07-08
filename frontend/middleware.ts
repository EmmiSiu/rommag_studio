/**
 * Protección de rutas /studio/*: sin la cookie de sesión (ligera, sin
 * token) se redirige a /login. La autorización REAL la hace el backend
 * en cada request; esto solo evita renderizar pantallas privadas a
 * visitantes sin sesión.
 */

import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "ai_session";

export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/studio") && !hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if ((pathname === "/login" || pathname === "/register") && hasSession) {
    return NextResponse.redirect(new URL("/studio/library", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/studio/:path*", "/login", "/register"],
};
