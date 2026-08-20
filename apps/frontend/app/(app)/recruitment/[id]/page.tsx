"use client";

import { useAppSession } from "@/hooks/session-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/recruitment/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createApi } from "@/lib/api";
import type { Candidate, CandidateStatus, CoffeeChat } from "@cba/types";

const ALL_STATUSES: CandidateStatus[] = [
  "applied", "coffee_chat", "interviewing", "offer", "accepted", "rejected", "withdrawn",
];

export default function CandidatePage() {
  const { id } = useParams<{ id: string }>();
  const session = useAppSession();
  const qc = useQueryClient();
  const router = useRouter();
  const api = () => createApi(session?.accessToken);

  const { data: candidate, isLoading } = useQuery<Candidate>({
    queryKey: ["candidate", id],
    queryFn: () => api().get(`/ops/v1/candidates/${id}`),
    enabled: !!session?.accessToken,
  });

  const { data: coffeeChats = [] } = useQuery<CoffeeChat[]>({
    queryKey: ["candidate", id, "coffee-chats"],
    queryFn: () => api().get(`/ops/v1/candidates/${id}/coffee-chats`),
    enabled: !!session?.accessToken,
  });

  interface CoffeeChatEvaluation {
    id: string;
    cycle_id: string;
    applicant_name: string;
    applicant_email: string;
    member_name: string;
    chat_date: string | null;
    score: number | null;
    comments: string | null;
  }

  const { data: evaluations = [] } = useQuery<CoffeeChatEvaluation[]>({
    queryKey: ["candidate", id, "evaluations"],
    queryFn: () => api().get(`/ops/v1/candidates/${id}/coffee-chat-evaluations`),
    enabled: !!session?.accessToken,
  });

  const updateStatus = useMutation({
    mutationFn: (status: CandidateStatus) =>
      api().patch(`/ops/v1/candidates/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["candidate", id] }),
  });

  const autoAssign = useMutation({
    mutationFn: () => api().post(`/ops/v1/candidates/${id}/coffee-chats/auto`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["candidate", id, "coffee-chats"] }),
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!candidate) return <div className="p-6 text-sm text-muted-foreground">Not found.</div>;

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{candidate.name}</h1>
          <p className="text-sm text-muted-foreground">{candidate.cornell_email} · {candidate.net_id}</p>
        </div>
        <StatusBadge status={candidate.status} />
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-4 rounded-lg border bg-white p-4 text-sm">
        {[
          ["Major", candidate.major],
          ["Grad Year", candidate.grad_year],
          ["Transfer", candidate.is_transfer ? "Yes" : "No"],
          ["College(s)", (candidate.college ?? []).join(", ")],
          ["Pronouns", candidate.pronouns],
          ["Personal Email", candidate.email],
        ].map(([label, value]) => (
          <div key={label as string}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-medium">{value || "—"}</p>
          </div>
        ))}
      </div>

      {/* Status update */}
      <div className="flex items-center gap-3 rounded-lg border bg-white p-4">
        <p className="text-sm font-medium">Move to</p>
        <Select
          value={candidate.status}
          onValueChange={(v) => updateStatus.mutate(v as CandidateStatus)}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Coffee chats */}
      <div className="rounded-lg border bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> Coffee Chats ({coffeeChats.length}/3)
          </h2>
          {coffeeChats.length < 3 && (
            <Button size="sm" variant="outline" onClick={() => autoAssign.mutate()} disabled={autoAssign.isPending}>
              Auto-assign
            </Button>
          )}
        </div>
        {coffeeChats.length === 0 ? (
          <p className="text-sm text-muted-foreground">No coffee chats assigned yet.</p>
        ) : (
          <ul className="space-y-2">
            {coffeeChats.map((chat) => (
              <li key={chat.id} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
                <span className="text-muted-foreground">{chat.member_name ?? chat.member_id.slice(0, 8)}</span>
                <div className="flex items-center gap-2">
                  {chat.score !== null && (
                    <Badge variant="secondary">Score: {chat.score}/3</Badge>
                  )}
                  <Badge variant={chat.completed ? "success" : "outline"}>
                    {chat.completed ? "Done" : "Pending"}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Coffee chat evaluations */}
      <div className="rounded-lg border bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold">Coffee Chat Evaluations</h2>
        {evaluations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No evaluations imported yet.</p>
        ) : (
          <ul className="space-y-3">
            {evaluations.map((ev) => {
              const score = ev.score;
              const scoreBg =
                score === null ? "bg-muted text-muted-foreground"
                : score < 2 ? "bg-red-100 text-red-700"
                : score < 3 ? "bg-yellow-100 text-yellow-700"
                : "bg-green-100 text-green-700";
              const scoreLabel =
                score === null ? "No score"
                : score < 2 ? "Unacceptable"
                : score < 3 ? "Would interview"
                : "Outstanding";
              return (
                <li key={ev.id} className="rounded-md bg-muted/40 px-3 py-3 text-sm space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{ev.member_name}</span>
                    <div className="flex items-center gap-2">
                      {ev.chat_date && (
                        <span className="text-xs text-muted-foreground">{ev.chat_date}</span>
                      )}
                      <span className={`text-xs font-medium rounded px-2 py-0.5 ${scoreBg}`}>
                        {score !== null ? `${score} — ${scoreLabel}` : scoreLabel}
                      </span>
                    </div>
                  </div>
                  {ev.comments && (
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{ev.comments}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Internal notes */}
      {candidate.notes && (
        <div className="rounded-lg border bg-white p-4 space-y-1">
          <h2 className="text-sm font-semibold">Internal Notes</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{candidate.notes}</p>
        </div>
      )}
    </div>
  );
}
