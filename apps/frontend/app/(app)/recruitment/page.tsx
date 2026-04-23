"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

export default function RecruitmentPage() {
  const { data: session } = useSession();
  const qc = useQueryClient();
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

  const { data: candidates = [], isLoading } = useQuery<Candidate[]>({
    queryKey: ["candidates", selectedCycle],
    queryFn: () => api().get(`/ops/v1/candidates?cycle_id=${selectedCycle}`),
    enabled: !!session?.accessToken && !!selectedCycle,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: CandidateStatus }) =>
      api().patch(`/ops/v1/candidates/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["candidates", selectedCycle] }),
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

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Recruitment</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} candidate{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
        {/* Cycle selector */}
        <Select value={selectedCycle} onValueChange={setCycleId}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Cycle" />
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

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search by name, email, netid…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-white overflow-hidden">
        {isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading candidates…</p>
        ) : filtered.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No candidates found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {["Name", "NetID", "Major", "Grad Year", "Status", "Update Status"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link
                      href={`/recruitment/${c.id}`}
                      className="font-medium hover:underline"
                    >
                      {c.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{c.cornell_email}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.net_id}</td>
                  <td className="px-4 py-3">{c.major ?? "—"}</td>
                  <td className="px-4 py-3">{c.grad_year ?? "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-3">
                    <Select
                      value={c.status}
                      onValueChange={(v) => updateStatus.mutate({ id: c.id, status: v as CandidateStatus })}
                    >
                      <SelectTrigger className="h-7 w-36 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_STATUSES.map((s) => (
                          <SelectItem key={s} value={s} className="text-xs">
                            {s.replace("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
