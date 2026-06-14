"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/recruitment/StatusBadge";
import { createApi } from "@/lib/api";
import type { ApplicationCycle, Candidate, CandidateStatus } from "@cba/types";

const ALL_STATUSES: CandidateStatus[] = [
  "applied", "coffee_chat", "interviewing", "offer", "accepted", "rejected", "withdrawn",
];

const STATUS_BORDER: Record<CandidateStatus, string> = {
  applied:      "border-l-slate-400",
  coffee_chat:  "border-l-sky-400",
  interviewing: "border-l-amber-400",
  offer:        "border-l-violet-400",
  accepted:     "border-l-emerald-500",
  rejected:     "border-l-red-400",
  withdrawn:    "border-l-gray-300",
};

const STATUS_DOT: Record<CandidateStatus, string> = {
  applied:      "bg-slate-400",
  coffee_chat:  "bg-sky-400",
  interviewing: "bg-amber-400",
  offer:        "bg-violet-400",
  accepted:     "bg-emerald-500",
  rejected:     "bg-red-400",
  withdrawn:    "bg-gray-300",
};

const STATUS_LABEL: Record<CandidateStatus, string> = {
  applied:      "Applied",
  coffee_chat:  "Coffee Chat",
  interviewing: "Interviewing",
  offer:        "Offer",
  accepted:     "Accepted",
  rejected:     "Rejected",
  withdrawn:    "Withdrawn",
};

export default function RecruitmentPage() {
  const { data: session } = useSession();
  const api = () => createApi(session?.accessToken);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [cycleId, setCycleId] = useState<string>("");

  const { data: cycles = [] } = useQuery<ApplicationCycle[]>({
    queryKey: ["cycles"],
    queryFn: () => api().get("/ops/v1/cycles"),
    enabled: !!session?.accessToken,
  });

  const activeCycle = cycles.find((c) => c.is_active);
  const selectedCycle = cycleId || activeCycle?.id || "";
  const currentCycleName = cycles.find((c) => c.id === selectedCycle)?.name ?? "";

  const { data: candidates = [], isLoading } = useQuery<Candidate[]>({
    queryKey: ["candidates", selectedCycle],
    queryFn: () => api().get(`/ops/v1/candidates?cycle_id=${selectedCycle}`),
    enabled: !!session?.accessToken && !!selectedCycle,
  });

  const filtered = candidates.filter((c) => {
    const matchSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      (c.net_id ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Pipeline counts computed from all candidates in this cycle (not filtered)
  const pipelineCounts = ALL_STATUSES.map((s) => ({
    status: s,
    count: candidates.filter((c) => c.status === s).length,
  })).filter((s) => s.count > 0);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {currentCycleName ? currentCycleName : "Recruitment"}
          </h1>
          {currentCycleName && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {candidates.length} candidate{candidates.length !== 1 ? "s" : ""} in pipeline
            </p>
          )}
        </div>
        <Select value={selectedCycle} onValueChange={setCycleId}>
          <SelectTrigger className="w-40 shrink-0">
            <SelectValue placeholder="Select cycle" />
          </SelectTrigger>
          <SelectContent>
            {cycles.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Pipeline progress strip */}
      {pipelineCounts.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {pipelineCounts.map(({ status, count }) => (
            <button
              key={status}
              onClick={() => setStatusFilter(statusFilter === status ? "all" : status)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                statusFilter === status
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-white hover:bg-muted/50 text-foreground"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status as CandidateStatus]}`} />
              {STATUS_LABEL[status as CandidateStatus]}
              <span className={`ml-0.5 ${statusFilter === status ? "text-background/70" : "text-muted-foreground"}`}>
                {count}
              </span>
            </button>
          ))}
          {statusFilter !== "all" && (
            <button
              onClick={() => setStatusFilter("all")}
              className="rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear filter
            </button>
          )}
        </div>
      )}

      {/* Search bar */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Search by name, email, NetID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-white overflow-hidden">
        {isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading candidates…</p>
        ) : filtered.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No candidates found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                {["Name", "NetID", "Major", "Grad Year", "Status"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className={`border-l-2 ${STATUS_BORDER[c.status]} hover:bg-muted/25 transition-colors`}
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/recruitment/${c.id}`}
                      className="font-medium hover:underline underline-offset-2"
                    >
                      {c.name}
                    </Link>
                    <p className="text-xs text-muted-foreground leading-tight mt-0.5">{c.cornell_email}</p>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{c.net_id}</td>
                  <td className="px-4 py-2.5">{c.major ?? "—"}</td>
                  <td className="px-4 py-2.5">{c.grad_year ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          Showing {filtered.length} of {candidates.length} candidate{candidates.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
