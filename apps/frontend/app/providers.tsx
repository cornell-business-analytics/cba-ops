"use client";

import type { Session } from "next-auth";
import { QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { getQueryClient } from "@/lib/query-client";

export function Providers({ children, session }: { children: React.ReactNode; session: Session | null }) {
  const queryClient = getQueryClient();

  return (
    <SessionProvider session={session}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </SessionProvider>
  );
}
