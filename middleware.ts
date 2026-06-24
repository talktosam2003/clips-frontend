import { withAuth } from "next-auth/middleware";
import { NextRequest, NextResponse } from "next/server";

export default withAuth(function middleware(request: NextRequest) {
  const token = request.nextauth.token;
  const pathname = request.nextUrl.pathname;

  // If user is authenticated and on "/" or "/login" or "/signup", redirect to dashboard
  if (token && (pathname === "/" || pathname === "/login" || pathname === "/signup")) {
    // Check onboarding step if available
    const onboardingStep = (token as any).onboardingStep || 3;
    
    if (onboardingStep === 1 || onboardingStep === 2) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
    
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Apply middleware to protected routes and auth routes
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/earnings/:path*",
    "/projects/:path*",
    "/vault/:path*",
    "/platforms/:path*",
    "/clips/:path*",
    "/",
    "/login",
    "/signup",
  ],
};
