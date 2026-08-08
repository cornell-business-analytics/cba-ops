"use client";

import { createContext, useContext } from "react";
import type { Session } from "next-auth";

const AppSessionContext = createContext<Session | null>(null);

export function AppSessionProvider({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
  return (
    <AppSessionContext.Provider value={session}>
      {children}
    </AppSessionContext.Provider>
  );
}

export function useAppSession(): Session | null {
  return useContext(AppSessionContext);
}
