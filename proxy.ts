import { NextResponse } from "next/server";
import { auth } from "./auth";
import { authRequiredCheckResponse } from "./proxy-auth-response";

export const proxy = auth((request) => {
  const isSignedIn = Boolean(request.auth?.user);
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/api/check")) {
    if (!isSignedIn) {
      return authRequiredCheckResponse(crypto.randomUUID(), pathname);
    }

    return NextResponse.next();
  }

  if (pathname === "/sign-in") {
    if (isSignedIn) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
  }

  if (!isSignedIn) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/api/check/:path*",
    "/((?!api/auth|api/health|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
