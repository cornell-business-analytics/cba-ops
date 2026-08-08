"use client";

import { useMemo } from "react";
import { useAppSession } from "@/hooks/session-context";
import { createApi } from "@/lib/api";

export function useApi() {
  const session = useAppSession();
  return useMemo(() => createApi(session?.accessToken), [session?.accessToken]);
}
