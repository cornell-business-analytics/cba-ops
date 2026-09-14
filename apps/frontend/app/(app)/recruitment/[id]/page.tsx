"use client";

import Image from "next/image";
import { useAppSession } from "@/hooks/session-context";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/recruitment/StatusBadge";
import { createApi } from "@/lib/api";
import type { CandidateStatus } from "@cba/types";

interface Candidate {
  id: string;
  cycle_id: string;
  name: string;
  email: string;
  cornell_email: string;
  net_id: string | null;
  pronouns: string | null;
  grad_year: string | null;
  is_transfer: boolean;
  college: string[];
  major: string | null;
  gender_identity: string | null;
  ethnicity: string[];
  resume_url: string | null;
  headshot_url: string | null;
  status: CandidateStatus;
  notes: string | null;
}


export default function CandidatePage() {
  const { id } = useParams<{ id: string }>();
  const session = useAppSession();
  const router = useRouter();
  const api = () => createApi(session?.accessToken);

  const { data: candidate, isLoading } = useQuery<Candidate>({
    queryKey: ["candidate", id],
    queryFn: () => api().get(`/ops/v1/candidates/${id}`),
    enabled: !!session?.accessToken,
  });

  interface InterviewScoreEnriched {
    id: string;
    session_id: string;
    candidate_id: string;
    member_id: string;
    category_id: string;
    numeric_score: number | null;
    ynm_score: string | null;
    comments: string | null;
    member_name: string | null;
    category_name: string | null;
    round_id: string | null;
    round_name: string | null;
    round_number: number | null;
    time_slot: string | null;
    group_label: string | null;
  }

  const { data: interviewScores = [], isError: scoresError, error: scoresErrorObj } = useQuery<InterviewScoreEnriched[]>({
    queryKey: ["candidate", id, "scores"],
    queryFn: () => api().get(`/ops/v1/candidates/${id}/scores`),
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

  const { data: evaluations = [], isError: evalsError, error: evalsErrorObj } = useQuery<CoffeeChatEvaluation[]>({
    queryKey: ["candidate", id, "evaluations"],
    queryFn: () => api().get(`/ops/v1/candidates/${id}/coffee-chat-evaluations`),
    enabled: !!session?.accessToken,
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

      {candidate.headshot_url && (
        <div className="rounded-xl overflow-hidden border bg-muted/20 w-full max-h-[420px] flex items-center justify-center">
          <Image
            src={candidate.headshot_url}
            alt={candidate.name}
            width={800}
            height={420}
            unoptimized
            className="w-full object-contain max-h-[420px]"
          />
        </div>
      )}

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
          ["Gender identity", candidate.gender_identity],
          ["Ethnicity", (candidate.ethnicity ?? []).join(", ")],
          ["Personal Email", candidate.email],
        ].map(([label, value]) => (
          <div key={label as string}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-medium">{value || "—"}</p>
          </div>
        ))}
      </div>


      {/* Interview scores */}
      {scoresError && (scoresErrorObj as any)?.status !== 404 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 space-y-1">
          <p className="text-sm font-medium text-amber-800">
            Interview scores failed to load
            {(scoresErrorObj as any)?.status ? ` (${(scoresErrorObj as any).status})` : ""}
          </p>
          <p className="text-xs text-amber-700 font-mono break-all">
            {scoresErrorObj instanceof Error ? scoresErrorObj.message : String(scoresErrorObj)}
          </p>
        </div>
      )}
      {interviewScores.length > 0 && (() => {
        // Group by round
        const rounds = Array.from(
          interviewScores.reduce((acc, s) => {
            const key = s.round_id ?? "unknown";
            if (!acc.has(key)) acc.set(key, { round_id: key, round_name: s.round_name ?? "Unknown Round", round_number: s.round_number ?? 0, scores: [] });
            acc.get(key)!.scores.push(s);
            return acc;
          }, new Map<string, { round_id: string; round_name: string; round_number: number; scores: InterviewScoreEnriched[] }>())
          .values()
        ).sort((a, b) => a.round_number - b.round_number);

        return (
          <div className="rounded-lg border bg-white p-4 space-y-4">
            <h2 className="text-sm font-semibold">Interview Scores</h2>
            {rounds.map((round) => {
              const categories = Array.from(new Set(round.scores.map(s => s.category_name ?? ""))).filter(Boolean);
              const members = Array.from(new Set(round.scores.map(s => s.member_name ?? ""))).filter(Boolean);
              return (
                <div key={round.round_id} className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{round.round_name}</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border rounded-md overflow-hidden">
                      <thead className="bg-muted/40">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Category</th>
                          {members.map(m => (
                            <th key={m} className="px-3 py-2 text-center font-medium text-muted-foreground">{m}</th>
                          ))}
                          <th className="px-3 py-2 text-center font-medium text-muted-foreground">Avg</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {categories.map(cat => {
                          const catScores = round.scores.filter(s => s.category_name === cat);
                          const numericValues = catScores.map(s => s.numeric_score).filter((v): v is number => v !== null);
                          const avg = numericValues.length > 0
                            ? (numericValues.reduce((a, b) => a + b, 0) / numericValues.length).toFixed(1)
                            : null;
                          return (
                            <tr key={cat} className="hover:bg-muted/20">
                              <td className="px-3 py-2 font-medium">{cat}</td>
                              {members.map(m => {
                                const score = catScores.find(s => s.member_name === m);
                                const val = score?.numeric_score ?? score?.ynm_score ?? null;
                                const scoreColor = typeof val === "number"
                                  ? val >= 4 ? "text-emerald-700 font-semibold"
                                    : val >= 3 ? "text-sky-700"
                                    : val >= 2 ? "text-amber-700"
                                    : "text-red-700"
                                  : "";
                                return (
                                  <td key={m} className="px-3 py-2 text-center">
                                    {val !== null
                                      ? <span className={scoreColor}>{val}</span>
                                      : <span className="text-muted-foreground">—</span>}
                                  </td>
                                );
                              })}
                              <td className="px-3 py-2 text-center font-semibold">
                                {avg ?? <span className="text-muted-foreground">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {/* Comments */}
                  {round.scores.filter(s => s.comments).length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      {round.scores.filter(s => s.comments).map(s => (
                        <div key={s.id} className="rounded bg-muted/40 px-3 py-2">
                          <span className="font-medium text-xs">{s.member_name}</span>
                          <span className="text-muted-foreground text-xs"> · {s.category_name}</span>
                          <p className="text-xs text-muted-foreground mt-0.5">{s.comments}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Coffee chat evaluations */}
      {evalsError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Coffee chat evaluations failed to load
          {(evalsErrorObj as any)?.status ? ` (${(evalsErrorObj as any).status})` : ""}: {evalsErrorObj instanceof Error ? evalsErrorObj.message : String(evalsErrorObj)}
        </div>
      )}
      {evaluations.length > 0 && (
        <div className="rounded-lg border bg-white p-4 space-y-3">
          <h2 className="text-sm font-semibold">Coffee Chat Evaluations</h2>
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
        </div>
      )}

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
