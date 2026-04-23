import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: { hd: "cornell.edu", prompt: "select_account" },
      },
    }),
  ],

  callbacks: {
    async jwt({ token, account }) {
      // Initial sign-in — exchange Google id_token for our backend JWT
      if (account?.id_token) {
        const res = await fetch(`${BACKEND_URL}/ops/v1/auth/google`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id_token: account.id_token }),
        });

        if (!res.ok) {
          return { ...token, error: "RefreshTokenError" as const };
        }

        const tokens = await res.json();
        return {
          ...token,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          accessTokenExpires: Date.now() + 55 * 60 * 1000, // 55 min (5 min buffer before 1h expiry)
        };
      }

      // Token still valid
      if (Date.now() < token.accessTokenExpires) {
        return token;
      }

      // Access token expired — refresh it
      try {
        const res = await fetch(`${BACKEND_URL}/ops/v1/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: token.refreshToken }),
        });

        if (!res.ok) throw new Error("Refresh failed");

        const tokens = await res.json();
        return {
          ...token,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          accessTokenExpires: Date.now() + 55 * 60 * 1000,
          error: undefined,
        };
      } catch {
        return { ...token, error: "RefreshTokenError" as const };
      }
    },

    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.error = token.error;
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },
});
