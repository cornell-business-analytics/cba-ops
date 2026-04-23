"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { createApi } from "@/lib/api";

export function useApi() {
  const { data: session } = useSession();
  return useMemo(() => createApi(session?.accessToken), [session?.accessToken]);
}
