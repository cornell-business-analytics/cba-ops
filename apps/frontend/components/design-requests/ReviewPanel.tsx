"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppSession } from "@/hooks/session-context";
import { createApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, ExternalLink, RotateCw } from "lucide-react";
import type { DesignRequest, DesignRequestStatusCheck } from "@cba/types";

const CI_LABEL: Record<string, string> = {
  success: "Checks passing",
  failure: "Checks failing",
  pending: "Checks running…",
};

export function ReviewPanel({
  request,
  currentUserId,
}: {
  request: DesignRequest;
  currentUserId: string | undefined;
}) {
  const session = useAppSession();
  const qc = useQueryClient();
  const api = () => createApi(session?.accessToken);
  const [note, setNote] = useState("");
  const [showRevise, setShowRevise] = useState(false);
  const [revisionNote, setRevisionNote] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["design-requests"] });
  };

  const review = useMutation({
    mutationFn: (status: "approved" | "rejected") =>
      api().patch(`/ops/v1/design-requests/${request.id}/review`, {
        status,
        reviewer_note: note || null,
      }),
    onSuccess: invalidate,
  });

  const retryDispatch = useMutation({
    mutationFn: () => api().post(`/ops/v1/design-requests/${request.id}/retry-dispatch`, {}),
    onSuccess: invalidate,
  });

  const confirm = useMutation({
    mutationFn: () => api().post(`/ops/v1/design-requests/${request.id}/confirm`, {}),
    onSuccess: invalidate,
  });

  const discard = useMutation({
    mutationFn: () => api().post(`/ops/v1/design-requests/${request.id}/discard`, {}),
    onSuccess: invalidate,
  });

  const revise = useMutation({
    mutationFn: () =>
      api().post(`/ops/v1/design-requests/${request.id}/revise`, {
        revision_note: revisionNote,
      }),
    onSuccess: () => {
      setShowRevise(false);
      setRevisionNote("");
      invalidate();
    },
  });

  const isPollable = request.status === "pr_open" || request.status === "merge_failed";
  const { data: check } = useQuery<DesignRequestStatusCheck>({
    queryKey: ["design-requests", request.id, "status"],
    queryFn: () => api().get(`/ops/v1/design-requests/${request.id}/status`),
    enabled: !!session?.accessToken && isPollable,
    refetchInterval: isPollable ? 5000 : false,
  });

  const isOwnRequest = !!currentUserId && currentUserId === request.requested_by_id;
  const ciGreen = check?.ci_status === "success";

  if (request.status === "pending") {
    return (
      <div className="flex items-center gap-3 px-4 py-3 border-t bg-muted/10">
        <input
          type="text"
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <Button
          size="sm"
          variant="outline"
          className="text-destructive hover:text-destructive border-destructive/30"
          disabled={review.isPending}
          onClick={() => review.mutate("rejected")}
        >
          <X className="h-3.5 w-3.5 mr-1" /> Reject
        </Button>
        <Button size="sm" disabled={review.isPending} onClick={() => review.mutate("approved")}>
          <Check className="h-3.5 w-3.5 mr-1" /> Approve
        </Button>
      </div>
    );
  }

  if (request.status === "agent_running") {
    return (
      <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/10">
        <p className="text-xs text-muted-foreground">Agent is running — check GitHub Actions for progress.</p>
        <Button
          size="sm"
          variant="outline"
          className="text-destructive hover:text-destructive border-destructive/30"
          disabled={discard.isPending}
          onClick={() => discard.mutate()}
        >
          Discard
        </Button>
      </div>
    );
  }

  if (request.status === "dispatch_failed" || request.status === "agent_failed") {
    return (
      <div className="space-y-2 px-4 py-3 border-t bg-muted/10">
        <p className="text-xs text-destructive">{request.agent_error ?? "The agent run failed."}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {request.pr_url && (
              <a
                href={request.pr_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                View PR <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <div className="flex gap-2">
            {request.pr_url && (
              <Button
                size="sm"
                variant="outline"
                disabled={revise.isPending || showRevise}
                onClick={() => setShowRevise(true)}
              >
                Request revision
              </Button>
            )}
            <Button size="sm" variant="outline" disabled={retryDispatch.isPending} onClick={() => retryDispatch.mutate()}>
              <RotateCw className="h-3.5 w-3.5 mr-1" /> Retry
            </Button>
          </div>
        </div>
        {showRevise && (
          <div className="space-y-2 pt-1">
            <textarea
              rows={2}
              placeholder="Describe what to change…"
              value={revisionNote}
              onChange={(e) => setRevisionNote(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setShowRevise(false); setRevisionNote(""); }}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!revisionNote.trim() || revise.isPending}
                onClick={() => revise.mutate()}
              >
                {revise.isPending ? "Sending…" : "Send to agent"}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (isPollable) {
    return (
      <div className="space-y-2 px-4 py-3 border-t bg-muted/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {check?.ci_status && (
              <Badge variant={check.ci_status === "success" ? "success" : check.ci_status === "failure" ? "destructive" : "warning"}>
                {CI_LABEL[check.ci_status] ?? check.ci_status}
              </Badge>
            )}
            {request.pr_url && (
              <a
                href={request.pr_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                View PR <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {check?.preview_url && (
              <a
                href={check.preview_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Preview <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>

        {request.status === "merge_failed" && (
          <p className="text-xs text-destructive">{request.agent_error ?? "Merge failed."}</p>
        )}

        {isOwnRequest && (
          <p className="text-xs text-muted-foreground italic">
            You submitted this request — someone else needs to confirm it.
          </p>
        )}

        {showRevise ? (
          <div className="space-y-2">
            <textarea
              rows={2}
              placeholder="Describe what to change…"
              value={revisionNote}
              onChange={(e) => setRevisionNote(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setShowRevise(false); setRevisionNote(""); }}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!revisionNote.trim() || revise.isPending}
                onClick={() => revise.mutate()}
              >
                {revise.isPending ? "Sending…" : "Send to agent"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive border-destructive/30"
              disabled={discard.isPending}
              onClick={() => discard.mutate()}
            >
              Discard
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowRevise(true)}
            >
              Request revision
            </Button>
            <Button
              size="sm"
              disabled={confirm.isPending || !ciGreen || isOwnRequest}
              onClick={() => confirm.mutate()}
            >
              {confirm.isPending ? "Merging…" : "Confirm & merge"}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return null;
}
