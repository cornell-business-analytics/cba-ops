import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type { UserRole } from "@cba/types";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

const useSecureCookies = process.env.NODE_ENV === "production";

function decodeJwtRole(token: string): UserRole | undefined {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    return payload.role as UserRole;
  } catch {
    return undefined;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  cookies: {
    pkceCodeVerifier: {
      name: `${useSecureCookies ? "__Secure-" : ""}authjs.pkce.code_verifier`,
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: useSecureCookies,
      },
    },
    state: {
      name: `${useSecureCookies ? "__Secure-" : ""}authjs.state`,
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: useSecureCookies,
      },
    },
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      checks: ["state"],
      authorization: {
        params: { hd: "cornell.edu" },
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
          accessTokenExpires: Date.now() + 55 * 60 * 1000,
          role: decodeJwtRole(tokens.access_token),
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
          role: decodeJwtRole(tokens.access_token),
          error: undefined,
        };
      } catch {
        return { ...token, error: "RefreshTokenError" as const };
      }
    },

    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.error = token.error;
      session.role = token.role;
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },
});
