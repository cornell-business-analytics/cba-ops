"use client";

import { useQuery } from "@tanstack/react-query";
import { useAppSession } from "@/hooks/session-context";
import { useCurrentUser } from "@/hooks/use-current-user";
import { createApi } from "@/lib/api";
import { RequestForm } from "@/components/design-requests/RequestForm";
import { StatusBadge } from "@/components/design-requests/StatusBadge";
import { ReviewPanel } from "@/components/design-requests/ReviewPanel";
import { Sparkles } from "lucide-react";
import type { DesignRequest } from "@cba/types";

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function DesignRequestsPage() {
  const session = useAppSession();
  const api = () => createApi(session?.accessToken);
  const { data: currentUser } = useCurrentUser();

  const isDirectorOrAbove =
    session?.role === "director" || session?.role === "recruitment" || session?.role === "eboard";

  const { data: requests = [], isLoading } = useQuery<DesignRequest[]>({
    queryKey: ["design-requests"],
    queryFn: () => api().get("/ops/v1/design-requests"),
    enabled: !!session?.accessToken,
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.some((r) => r.status === "agent_running" || r.status === "approved") ? 5000 : false;
    },
  });

  return (
    <div className="p-6 max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Design Requests</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isDirectorOrAbove
            ? "Requests from members, plus your own."
            : "Requests you've submitted."}
        </p>
      </div>

      <RequestForm />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : requests.length === 0 ? (
        <div className="rounded-lg border bg-white p-12 text-center">
          <Sparkles className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No design requests yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div key={req.id} className="rounded-lg border bg-white overflow-hidden">
              <div className="flex items-start justify-between gap-3 px-4 py-3 border-b bg-muted/20">
                <p className="text-sm leading-relaxed">{req.description}</p>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusBadge status={req.status} />
                  {req.created_at && (
                    <span className="text-xs text-muted-foreground">{formatDate(req.created_at)}</span>
                  )}
                </div>
              </div>

              {req.status !== "pending" && req.reviewer_note && (
                <div className="px-4 py-2 border-t text-xs text-muted-foreground italic">
                  Note: {req.reviewer_note}
                </div>
              )}

              {isDirectorOrAbove && (
                <ReviewPanel request={req} currentUserId={currentUser?.id} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
