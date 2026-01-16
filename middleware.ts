
import { clerkMiddleware } from '@clerk/nextjs/server';

export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!\\.next|\\_next|static|favicon.ico|html|css|js|json|jpg|jpeg|png|gif|svg|woff|woff2|ttf|eot|ico|webmanifest|robots.txt|sitemap.xml).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
