import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Define public routes and matchers for protected/admin routes
const publicRoutes = ["/", "/api/webhook/register", "/sign-in", "/sign-up"];
const isAdminRoute = createRouteMatcher(['/admin(.*)']);  // Admin routes matcher
const isProtectedRoute = createRouteMatcher(['/dashboard(.*)', '/forum(.*)']);  // Protected routes matcher

// Define type for sessionClaims
interface SessionClaims {
  metadata?: {
    role?: string;
  };
}

export default clerkMiddleware(async (auth, req) => {
  const { userId, redirectToSignIn, sessionClaims } = await auth();  // Get userId and session claims

  // If no user is authenticated and trying to access protected routes
  if (!userId && isProtectedRoute(req)) {
    return redirectToSignIn();
  }

  if (userId) {
    try {
      // Cast sessionClaims to a known type (SessionClaims) to access role
      const role = (sessionClaims as SessionClaims)?.metadata?.role;

      // Redirect if the user is not an admin and trying to access admin routes
      if (role !== 'admin' && isAdminRoute(req)) {
        return NextResponse.redirect(new URL('/dashboard', req.url));
      }

      // Redirect admin users who are not on admin routes
      if (role === 'admin' && !isAdminRoute(req)) {
        return NextResponse.redirect(new URL('/admin/dashboard', req.url));
      }

      // Redirect authenticated users trying to access public routes
      if (publicRoutes.includes(req.nextUrl.pathname)) {
        return NextResponse.redirect(
          new URL(role === 'admin' ? '/admin/dashboard' : '/dashboard', req.url)
        );
      }
    } catch (error) {
      console.error('Error fetching user data from Clerk:', error);
      return NextResponse.redirect(new URL('/error', req.url));
    }
  }

  // Allow the request to proceed if the user is authenticated or the route is public
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
