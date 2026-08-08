"use client";

import { useAppSession } from "@/hooks/session-context";
import { useQuery } from "@tanstack/react-query";
import { createApi } from "@/lib/api";
import type { User } from "@cba/types";

export function useCurrentUser() {
  const session = useAppSession();
  return useQuery<User>({
    queryKey: ["users", "me"],
    queryFn: () => createApi(session?.accessToken).get("/ops/v1/users/me"),
    enabled: !!session?.accessToken,
  });
}
