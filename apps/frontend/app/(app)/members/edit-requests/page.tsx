"use client";

import { useState } from "react";
import { useAppSession } from "@/hooks/session-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Check, X, Clock, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createApi } from "@/lib/api";
import type { ProfileEditRequest, MembershipDetail } from "@cba/types";

const FIELD_LABELS: Record<string, string> = {
  bio: "Bio",
  interests: "Interests",
  campus_involvements: "Campus Involvements",
  professional_experience: "Professional Experience",
  professional_is_interests: "Prof. field is interests",
  hometown: "Hometown",
  linkedin_url: "LinkedIn URL",
  major: "Major",
  grad_year: "Grad Year",
};

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function EditRequestsPage() {
  const session = useAppSession();
  const api = () => createApi(session?.accessToken);
  const qc = useQueryClient();

  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});

  const isDirectorOrAbove =
    session?.role === "director" ||
    session?.role === "recruitment" ||
    session?.role === "eboard";

  const { data: requests = [], isLoading } = useQuery<ProfileEditRequest[]>({
    queryKey: ["edit-requests", filter],
    queryFn: () => api().get(`/ops/v1/edit-requests?pending_only=${filter === "pending"}`),
    enabled: !!session?.accessToken && isDirectorOrAbove,
  });

  const { data: members = [] } = useQuery<MembershipDetail[]>({
    queryKey: ["members"],
    queryFn: () => api().get("/ops/v1/members"),
    enabled: !!session?.accessToken,
  });

  const memberMap = Object.fromEntries(members.map((m) => [m.id, m]));

  const review = useMutation({
    mutationFn: ({ reqId, status, note }: { reqId: string; status: string; note?: string }) =>
      api().patch(`/ops/v1/edit-requests/${reqId}/review`, {
        status,
        reviewer_note: note ?? null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["edit-requests"] });
    },
  });

  if (!isDirectorOrAbove) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">You don&apos;t have permission to view this page.</p>
      </div>
    );
  }

  const pending = requests.filter((r) => r.status === "pending");

  return (
    <div className="p-6 max-w-4xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Profile Edit Requests</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {pending.length > 0
              ? `${pending.length} pending request${pending.length !== 1 ? "s" : ""}`
              : "No pending requests"}
          </p>
        </div>
        <div className="flex rounded-lg border overflow-hidden text-sm">
          {(["pending", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 capitalize transition-colors ${
                filter === f
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : requests.length === 0 ? (
        <div className="rounded-lg border bg-white p-12 text-center">
          <Clock className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {filter === "pending" ? "No pending requests." : "No requests found."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const member = memberMap[req.membership_id];
            const note = noteInputs[req.id] ?? "";

            return (
              <div key={req.id} className={`rounded-lg border bg-white overflow-hidden ${
                req.status === "pending" ? "border-amber-200" : ""
              }`}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{member?.user_name ?? "Unknown member"}</p>
                        {req.status === "pending" && (
                          <Badge variant="warning" className="text-xs">Pending</Badge>
                        )}
                        {req.status === "approved" && (
                          <Badge variant="success" className="text-xs">Approved</Badge>
                        )}
                        {req.status === "rejected" && (
                          <Badge variant="destructive" className="text-xs">Rejected</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {member?.user_email}
                        {req.created_at && ` · ${formatDate(req.created_at)}`}
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/members/${req.membership_id}`}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    View profile <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>

                {/* Changes */}
                <div className="px-4 py-3 space-y-2">
                  {Object.entries(req.changes).map(([field, value]) => (
                    <div key={field} className="grid grid-cols-[140px_1fr] gap-3 text-sm">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-0.5">
                        {FIELD_LABELS[field] ?? field}
                      </p>
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
                        {String(value)}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                {req.status === "pending" && (
                  <div className="flex items-center gap-3 px-4 py-3 border-t bg-muted/10">
                    <input
                      type="text"
                      placeholder="Note (optional)"
                      value={note}
                      onChange={(e) => setNoteInputs((prev) => ({ ...prev, [req.id]: e.target.value }))}
                      className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive border-destructive/30"
                      disabled={review.isPending}
                      onClick={() => review.mutate({ reqId: req.id, status: "rejected", note })}
                    >
                      <X className="h-3.5 w-3.5 mr-1" /> Reject
                    </Button>
                    <Button
                      size="sm"
                      disabled={review.isPending}
                      onClick={() => review.mutate({ reqId: req.id, status: "approved", note })}
                    >
                      <Check className="h-3.5 w-3.5 mr-1" /> Approve
                    </Button>
                  </div>
                )}

                {/* Reviewer note on reviewed requests */}
                {req.status !== "pending" && req.reviewer_note && (
                  <div className="px-4 py-2 border-t text-xs text-muted-foreground italic">
                    Note: {req.reviewer_note}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
