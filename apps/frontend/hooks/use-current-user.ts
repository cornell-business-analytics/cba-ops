"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { createApi } from "@/lib/api";
import type { User } from "@cba/types";

export function useCurrentUser() {
  const { data: session } = useSession();
  return useQuery<User>({
    queryKey: ["users", "me"],
    queryFn: () => createApi(session?.accessToken).get("/ops/v1/users/me"),
    enabled: !!session?.accessToken,
  });
}
