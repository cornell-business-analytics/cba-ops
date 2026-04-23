export { auth as middleware } from "@/auth";

export const config = {
  // Protect all routes except login, NextAuth API routes, and Next.js internals
  matcher: ["/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)"],
};
