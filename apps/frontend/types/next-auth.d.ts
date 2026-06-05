import "next-auth";
import "next-auth/jwt";
import type { UserRole } from "@cba/types";

declare module "next-auth" {
  interface Session {
    accessToken: string;
    role?: UserRole;
    error?: "RefreshTokenError";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken: string;
    refreshToken: string;
    accessTokenExpires: number;
    role?: UserRole;
    error?: "RefreshTokenError";
  }
}
