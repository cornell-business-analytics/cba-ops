"use client";

import { useEffect, useState } from "react";
import { useAppSession } from "@/hooks/session-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Search, Plus, FileSpreadsheet, ChevronRight, Users, Check, ExternalLink, FileDown, RefreshCw, Settings, Trash2, ClipboardList, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/recruitment/StatusBadge";
import { createApi } from "@/lib/api";
import type { CandidateStatus } from "@cba/types";

interface ApplicationCycle {
  id: string;
  name: string;
  open_date: string | null;
  close_date: string | null;
  is_active: boolean;
  sheet_url: string | null;
  column_mapping: Record<string, string> | null;
}

interface InterviewCategory {
  id: string;
  name: string;
  display_order: number;
}

interface InterviewRound {
  id: string;
  round_number: number;
  name: string;
  score_format: "numeric" | "ynm";
  interview_format: "group" | "individual";
  is_default: boolean;
  score_sheet_url: string | null;
  categories: InterviewCategory[];
}

interface Candidate {
  id: string;
  cycle_id: string;
  name: string;
  email: string;
  cornell_email: string;
  net_id: string | null;
  major: string | null;
  grad_year: string | null;
  status: CandidateStatus;
}

const PIPELINE_STAGES: { status: CandidateStatus; label: string; color: string; bg: string }[] = [
  { status: "applied",      label: "Applied",      color: "text-slate-600",   bg: "bg-slate-100" },
  { status: "coffee_chat",  label: "Coffee Chat",  color: "text-sky-700",     bg: "bg-sky-100" },
  { status: "interviewing", label: "Interviewing", color: "text-amber-700",   bg: "bg-amber-100" },
  { status: "offer",        label: "Offer",        color: "text-violet-700",  bg: "bg-violet-100" },
  { status: "accepted",     label: "Accepted",     color: "text-emerald-700", bg: "bg-emerald-100" },
];

const OTHER_STATUSES: { status: CandidateStatus; label: string }[] = [
  { status: "rejected",  label: "Rejected" },
  { status: "withdrawn", label: "Withdrawn" },
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

function toSheetUrl(raw: string): string {
  const s = raw.trim();
  if (s.startsWith("http")) return s;
  if (s.includes("spreadsheets/d/")) return `https://docs.google.com/${s}`;
  return `https://docs.google.com/spreadsheets/d/${s}`;
}

export default function RecruitmentPage() {
  const session = useAppSession();
  const api = () => createApi(session?.accessToken);
  const qc = useQueryClient();

  const canManage = session?.role === "recruitment" || session?.role === "eboard" || session?.role === "director";

  const [selectedCycleId, setSelectedCycleId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // New cycle dialog
  const [newCycleOpen, setNewCycleOpen] = useState(false);
  const [newCycleForm, setNewCycleForm] = useState({ name: "", sheet_url: "" });

  // Sheet dialog
  const [sheetDialogOpen, setSheetDialogOpen] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [sheetSaved, setSheetSaved] = useState(false);

  // Column mapping dialog
  const [colMapOpen, setColMapOpen] = useState(false);
  const [colMapForm, setColMapForm] = useState<Record<string, string>>({});

  // Import state
  const [importStatus, setImportStatus] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [importMsg, setImportMsg] = useState<string | null>(null);

  // Delete headshots confirm
  const [deleteHsOpen, setDeleteHsOpen] = useState(false);

  // Rounds
  const [roundUrls, setRoundUrls] = useState<Record<string, string>>({});
  const [roundStatus, setRoundStatus] = useState<Record<string, { status: "idle" | "syncing" | "done" | "error"; msg: string | null }>>({});
  const [newRoundOpen, setNewRoundOpen] = useState(false);
  const [newRoundForm, setNewRoundForm] = useState({ name: "", round_number: 1, score_format: "numeric", interview_format: "group" });

  const { data: cycles = [], isLoading: cyclesLoading } = useQuery<ApplicationCycle[]>({
    queryKey: ["app-cycles"],
    queryFn: () => api().get("/ops/v1/cycles"),
    enabled: !!session?.accessToken,
  });

  const { data: candidates = [], isLoading: candidatesLoading } = useQuery<Candidate[]>({
    queryKey: ["candidates", selectedCycleId],
    queryFn: () => api().get(`/ops/v1/candidates?cycle_id=${selectedCycleId}`),
    enabled: !!session?.accessToken && !!selectedCycleId,
  });

  const { data: rounds = [] } = useQuery<InterviewRound[]>({
    queryKey: ["rounds", selectedCycleId],
    queryFn: () => api().get(`/ops/v1/cycles/${selectedCycleId}/rounds`),
    enabled: !!session?.accessToken && !!selectedCycleId,
  });

  // Auto-select active cycle (or first) on load
  useEffect(() => {
    if (selectedCycleId || cycles.length === 0) return;
    const active = cycles.find((c) => c.is_active) ?? cycles[0];
    setSelectedCycleId(active.id);
  }, [cycles, selectedCycleId]);

  // Sync round URL inputs when rounds data loads
  useEffect(() => {
    if (rounds.length === 0) return;
    setRoundUrls(prev => {
      const next = { ...prev };
      for (const r of rounds) {
        if (!(r.id in next)) next[r.id] = r.score_sheet_url ?? "";
      }
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rounds]);

  const selectedCycle = cycles.find((c) => c.id === selectedCycleId) ?? null;

  const createCycle = useMutation({
    mutationFn: () => api().post<ApplicationCycle>("/ops/v1/cycles", {
      name: newCycleForm.name,
      sheet_url: newCycleForm.sheet_url || null,
    }),
    onSuccess: (data: ApplicationCycle) => {
      qc.invalidateQueries({ queryKey: ["app-cycles"] });
      setSelectedCycleId(data.id);
      setNewCycleOpen(false);
      setNewCycleForm({ name: "", sheet_url: "" });
    },
  });

  const saveSheetUrl = useMutation({
    mutationFn: () => api().patch<ApplicationCycle>(`/ops/v1/cycles/${selectedCycleId}`, {
      sheet_url: sheetUrl || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app-cycles"] });
      setSheetSaved(true);
    },
  });

  const [delibLoading, setDelibLoading] = useState(false);

  async function downloadDelibDeck() {
    if (!session?.accessToken || !selectedCycleId) return;
    setDelibLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? ""}/ops/v1/cycles/${selectedCycleId}/delib-deck`,
        { headers: { Authorization: `Bearer ${session.accessToken}` } }
      );
      if (!res.ok) throw new Error("Failed to generate deck");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `delib_${selectedCycle?.name ?? "deck"}.pptx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDelibLoading(false);
    }
  }

  const toggleActive = useMutation({
    mutationFn: (cycle: ApplicationCycle) =>
      api().patch<ApplicationCycle>(`/ops/v1/cycles/${cycle.id}`, { is_active: !cycle.is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["app-cycles"] }),
  });

  const importMutation = useMutation({
    mutationFn: () => api().post<{ imported: number; updated: number; skipped: number; missing_cols: string[] }>(
      `/ops/v1/cycles/${selectedCycleId}/import`, {}
    ),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["candidates", selectedCycleId] });
      setImportStatus("done");
      const parts: string[] = [];
      if (data.imported > 0) parts.push(`${data.imported} new`);
      if (data.updated > 0) parts.push(`${data.updated} updated`);
      if (data.skipped > 0) parts.push(`${data.skipped} skipped`);
      setImportMsg(parts.length ? parts.join(", ") : "Up to date");
      if (data.missing_cols.length > 0) setImportMsg(m => `${m} · missing: ${data.missing_cols.join(", ")}`);
    },
    onError: (err: Error) => { setImportStatus("error"); setImportMsg(err.message); },
  });

  const saveColMap = useMutation({
    mutationFn: (mapping: Record<string, string>) =>
      api().patch<ApplicationCycle>(`/ops/v1/cycles/${selectedCycleId}`, { column_mapping: mapping }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["app-cycles"] }); setColMapOpen(false); },
  });

  const purgeHeadshots = useMutation({
    mutationFn: () => api().delete<{ deleted: number }>(`/ops/v1/cycles/${selectedCycleId}/headshots`),
    onSuccess: (data) => { qc.invalidateQueries({ queryKey: ["candidates", selectedCycleId] }); setDeleteHsOpen(false); alert(`Deleted ${data.deleted} headshot(s) from storage.`); },
    onError: (err: Error) => { alert(`Failed: ${err.message}`); },
  });

  const createRound = useMutation({
    mutationFn: (form: typeof newRoundForm) =>
      api().post<InterviewRound>(`/ops/v1/cycles/${selectedCycleId}/rounds`, {
        ...form,
        round_number: Number(form.round_number),
        categories: [],
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rounds", selectedCycleId] });
      setNewRoundOpen(false);
      setNewRoundForm(f => ({ ...f, name: "", round_number: f.round_number + 1 }));
    },
  });

  async function saveRoundUrl(roundId: string) {
    const url = roundUrls[roundId] ?? "";
    await api().patch(`/ops/v1/rounds/${roundId}`, { score_sheet_url: url || null });
    qc.invalidateQueries({ queryKey: ["rounds", selectedCycleId] });
  }

  async function importRoundScores(roundId: string) {
    setRoundStatus(s => ({ ...s, [roundId]: { status: "syncing", msg: null } }));
    try {
      const data = await api().post<{ imported: number; updated: number; skipped: number; missing_candidates: string[]; missing_members: string[] }>(
        `/ops/v1/rounds/${roundId}/import-scores`, {}
      );
      const parts: string[] = [];
      if (data.imported > 0) parts.push(`${data.imported} new`);
      if (data.updated > 0) parts.push(`${data.updated} updated`);
      if (data.skipped > 0) parts.push(`${data.skipped} skipped`);
      let msg = parts.length ? parts.join(", ") : "Up to date";
      if (data.missing_candidates.length > 0) msg += ` · unmatched candidates: ${data.missing_candidates.join(", ")}`;
      if (data.missing_members.length > 0) msg += ` · unmatched members: ${data.missing_members.join(", ")}`;
      setRoundStatus(s => ({ ...s, [roundId]: { status: "done", msg } }));
    } catch (err) {
      setRoundStatus(s => ({ ...s, [roundId]: { status: "error", msg: (err as Error).message } }));
    }
  }

  const filtered = candidates.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch = !search
      || c.name.toLowerCase().includes(q)
      || c.cornell_email.toLowerCase().includes(q)
      || (c.net_id ?? "").toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stageCounts = PIPELINE_STAGES.map((s) => ({
    ...s,
    count: candidates.filter((c) => c.status === s.status).length,
  }));

  const otherCounts = OTHER_STATUSES.map((s) => ({
    ...s,
    count: candidates.filter((c) => c.status === s.status).length,
  })).filter((s) => s.count > 0);

  // Total pipeline (applied → accepted)
  const pipelineTotal = stageCounts.reduce((sum, s) => sum + s.count, 0);
  const maxStageCount = Math.max(...stageCounts.map((s) => s.count), 1);

  // ─── Empty state ──────────────────────────────────────────────────────────
  if (!cyclesLoading && cycles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <div className="rounded-xl border border-dashed border-border p-12 text-center max-w-sm">
          <Users className="h-10 w-10 mx-auto text-muted-foreground/40 mb-4" />
          <h2 className="text-lg font-semibold mb-1">No recruitment cycles yet</h2>
          <p className="text-sm text-muted-foreground mb-5">
            Create a cycle to start tracking candidates and connecting your application sheet.
          </p>
          {canManage && (
            <Button onClick={() => setNewCycleOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Create First Cycle
            </Button>
          )}
        </div>
        <NewCycleDialog
          open={newCycleOpen}
          onOpenChange={setNewCycleOpen}
          form={newCycleForm}
          setForm={setNewCycleForm}
          onSubmit={() => createCycle.mutate()}
          isPending={createCycle.isPending}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Recruitment</h1>
        {canManage && (
          <Button size="sm" onClick={() => setNewCycleOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Cycle
          </Button>
        )}
      </div>

      {/* Cycle selector */}
      <div className="flex items-center gap-2 flex-wrap">
        {cycles.map((c) => (
          <button
            key={c.id}
            onClick={() => { setSelectedCycleId(c.id); setStatusFilter("all"); setSearch(""); }}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
              selectedCycleId === c.id
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-white text-foreground hover:bg-muted/40"
            }`}
          >
            {c.name}
            {c.is_active && (
              <span className={`h-1.5 w-1.5 rounded-full ${selectedCycleId === c.id ? "bg-emerald-400" : "bg-emerald-500"}`} />
            )}
          </button>
        ))}
      </div>

      {selectedCycle && (
        <>
          {/* Sheet connection banner */}
          <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
            selectedCycle.sheet_url
              ? "border-emerald-200 bg-emerald-50"
              : "border-dashed border-border bg-muted/20"
          }`}>
            <FileSpreadsheet className={`h-4 w-4 shrink-0 ${selectedCycle.sheet_url ? "text-emerald-600" : "text-muted-foreground"}`} />
            {selectedCycle.sheet_url ? (
              <>
                <span className="text-emerald-800 font-medium">Application sheet connected</span>
                <a
                  href={toSheetUrl(selectedCycle.sheet_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-emerald-700 hover:underline ml-1"
                >
                  Open sheet <ExternalLink className="h-3 w-3" />
                </a>
                <div className="ml-auto flex items-center gap-2">
                  {/* Import status */}
                  {importStatus !== "idle" && (
                    <span className={`text-xs flex items-center gap-1 ${importStatus === "error" ? "text-destructive" : "text-emerald-700"}`}>
                      {importStatus === "syncing" && <RefreshCw className="h-3 w-3 animate-spin" />}
                      {importStatus === "done" && <Check className="h-3 w-3" />}
                      {importMsg}
                    </span>
                  )}
                  <Button size="sm" variant="outline" className="h-7 text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                    onClick={() => { setSheetUrl(selectedCycle.sheet_url ?? ""); setSheetSaved(false); setSheetDialogOpen(true); }}>
                    Update sheet
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={importMutation.isPending}
                    onClick={() => { setImportStatus("syncing"); setImportMsg(null); importMutation.mutate(); }}
                  >
                    <RefreshCw className={`h-3 w-3 mr-1 ${importMutation.isPending ? "animate-spin" : ""}`} />
                    Import candidates
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" title="Column mapping"
                    onClick={() => { setColMapForm(selectedCycle.column_mapping ?? {}); setColMapOpen(true); }}>
                    <Settings className="h-3 w-3" />
                  </Button>
                </div>
              </>
            ) : (
              <>
                <span className="text-muted-foreground">No application sheet connected</span>
                {canManage && (
                  <Button size="sm" variant="outline" className="ml-auto h-7 text-xs"
                    onClick={() => { setSheetUrl(""); setSheetSaved(false); setSheetDialogOpen(true); }}>
                    <FileSpreadsheet className="h-3 w-3 mr-1" /> Connect Sheet
                  </Button>
                )}
              </>
            )}
          </div>

          {/* Pipeline funnel */}
          {candidates.length > 0 && (
            <div className="rounded-lg border bg-white p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pipeline</p>
                <p className="text-xs text-muted-foreground">{pipelineTotal} active · {candidates.length} total</p>
              </div>
              <div className="flex items-stretch gap-1">
                {stageCounts.map((s, i) => (
                  <button
                    key={s.status}
                    onClick={() => setStatusFilter(statusFilter === s.status ? "all" : s.status)}
                    className={`flex-1 rounded-md px-2 py-2.5 text-left transition-all hover:opacity-90 ${s.bg} ${
                      statusFilter === s.status ? "ring-2 ring-offset-1 ring-foreground/30" : ""
                    }`}
                  >
                    <p className={`text-xl font-bold ${s.color}`}>{s.count}</p>
                    <p className={`text-xs mt-0.5 font-medium ${s.color} opacity-80`}>{s.label}</p>
                    {i < stageCounts.length - 1 && (
                      <div className={`mt-1.5 h-0.5 rounded-full ${s.count > 0 ? "bg-current opacity-20" : "bg-border"}`}
                        style={{ width: `${Math.round((s.count / maxStageCount) * 100)}%` }} />
                    )}
                  </button>
                ))}
                {otherCounts.length > 0 && (
                  <div className="flex flex-col gap-1 justify-center pl-2 border-l ml-1">
                    {otherCounts.map((s) => (
                      <button
                        key={s.status}
                        onClick={() => setStatusFilter(statusFilter === s.status ? "all" : s.status)}
                        className={`flex items-center gap-2 px-2 py-1 rounded text-xs text-muted-foreground hover:bg-muted/50 ${
                          statusFilter === s.status ? "bg-muted font-medium text-foreground" : ""
                        }`}
                      >
                        <span className="font-semibold text-foreground">{s.count}</span> {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {statusFilter !== "all" && (
                <button
                  onClick={() => setStatusFilter("all")}
                  className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                >
                  Clear filter
                </button>
              )}
            </div>
          )}

          {/* Interview rounds */}
          {(session?.role === "director" || session?.role === "eboard") && (
            <div className="rounded-lg border bg-white p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <ClipboardList className="h-3.5 w-3.5" /> Interview Rounds
                </p>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setNewRoundOpen(true)}>
                  <Plus className="h-3 w-3 mr-1" /> Add round
                </Button>
              </div>
              {rounds.length === 0 ? (
                <p className="text-xs text-muted-foreground">No rounds yet. Add a round to start tracking interview scores.</p>
              ) : (
                <div className="space-y-3">
                  {rounds.sort((a, b) => a.round_number - b.round_number).map((round) => {
                    const rs = roundStatus[round.id] ?? { status: "idle", msg: null };
                    const localUrl = roundUrls[round.id] ?? round.score_sheet_url ?? "";
                    const urlChanged = localUrl !== (round.score_sheet_url ?? "");
                    return (
                      <div key={round.id} className="rounded-md border p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">{round.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {round.score_format === "numeric" ? "Numeric (0–5)" : "Y/M/N"} · {round.categories.map(c => c.name).join(", ") || "No categories"}
                            </p>
                          </div>
                          {rs.status !== "idle" && (
                            <span className={`text-xs flex items-center gap-1 ${rs.status === "error" ? "text-destructive" : "text-emerald-700"}`}>
                              {rs.status === "syncing" && <RefreshCw className="h-3 w-3 animate-spin" />}
                              {rs.status === "done" && <Check className="h-3 w-3" />}
                              {rs.status === "error" && <AlertCircle className="h-3 w-3" />}
                              <span className="max-w-xs truncate">{rs.msg}</span>
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            className="h-7 text-xs flex-1"
                            placeholder="Paste score sheet URL…"
                            value={localUrl}
                            onChange={e => setRoundUrls(u => ({ ...u, [round.id]: e.target.value }))}
                          />
                          {urlChanged && (
                            <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => saveRoundUrl(round.id)}>
                              Save URL
                            </Button>
                          )}
                          <Button
                            size="sm"
                            className="h-7 text-xs shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white"
                            disabled={!round.score_sheet_url || rs.status === "syncing"}
                            onClick={() => importRoundScores(round.id)}
                          >
                            <RefreshCw className={`h-3 w-3 mr-1 ${rs.status === "syncing" ? "animate-spin" : ""}`} />
                            Import scores
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Controls row */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search by name, email, NetID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Button
                size="sm"
                variant="outline"
                onClick={downloadDelibDeck}
                disabled={delibLoading || candidates.length === 0}
                title="Download PowerPoint delib deck for interviewing/offer/accepted candidates"
              >
                <FileDown className="h-4 w-4 mr-1" />
                {delibLoading ? "Generating…" : "Delib Deck"}
              </Button>
              {canManage && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toggleActive.mutate(selectedCycle)}
                  disabled={toggleActive.isPending}
                >
                  {selectedCycle.is_active ? "Close cycle" : "Mark active"}
                </Button>
              )}
              {(session?.role === "director" || session?.role === "eboard") && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  title="Delete all headshots from storage for this cycle"
                  onClick={() => setDeleteHsOpen(true)}
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Delete headshots
                </Button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="rounded-lg border bg-white overflow-hidden">
            {candidatesLoading ? (
              <p className="p-4 text-sm text-muted-foreground">Loading candidates…</p>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm text-muted-foreground">
                  {candidates.length === 0
                    ? "No candidates yet. Connect your application sheet to import."
                    : "No candidates match your search."}
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b">
                  <tr>
                    {["Name", "NetID", "Major", "Grad Year", "Status", ""].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((c) => (
                    <tr key={c.id} className={`border-l-2 ${STATUS_BORDER[c.status]} hover:bg-muted/20 transition-colors`}>
                      <td className="px-4 py-2.5">
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{c.cornell_email}</p>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">{c.net_id ?? "—"}</td>
                      <td className="px-4 py-2.5">{c.major ?? "—"}</td>
                      <td className="px-4 py-2.5">{c.grad_year ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Link href={`/recruitment/${c.id}`} className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground">
                          View <ChevronRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {filtered.length > 0 && filtered.length < candidates.length && (
            <p className="text-xs text-muted-foreground text-right">
              Showing {filtered.length} of {candidates.length} candidate{candidates.length !== 1 ? "s" : ""}
            </p>
          )}
        </>
      )}

      {/* New Cycle dialog */}
      <NewCycleDialog
        open={newCycleOpen}
        onOpenChange={setNewCycleOpen}
        form={newCycleForm}
        setForm={setNewCycleForm}
        onSubmit={() => createCycle.mutate()}
        isPending={createCycle.isPending}
        error={createCycle.isError ? (createCycle.error as Error).message : null}
      />

      {/* Column mapping dialog */}
      <Dialog open={colMapOpen} onOpenChange={setColMapOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Settings className="h-4 w-4" /> Column Mapping</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Enter the exact column header from your Google Form/Sheet. Leave blank to use the default.</p>
          <div className="space-y-3 py-2">
            {([
              ["timestamp_col", "Timestamp", "Timestamp"],
              ["personal_email_col", "Personal Email", "Email Address"],
              ["cornell_email_col", "Cornell Email", "Cornell Email"],
              ["name_col", "Name", "Name"],
              ["pronouns_col", "Pronouns", "Pronouns"],
              ["netid_col", "NetID", "NetID"],
              ["year_col", "Year", "Year"],
              ["transfer_col", "Transfer student?", "Are you a transfer student?"],
              ["college_col", "College", "College"],
              ["major_col", "Major(s)", "Major(s)"],
              ["headshot_col", "Headshot upload", "Please upload a headshot"],
              ["gender_col", "Gender identity", "How do you identify?"],
              ["ethnicity_col", "Ethnicity", "How do you identify?.1"],
            ] as [string, string, string][]).map(([key, label, placeholder]) => (
              <div key={key} className="grid grid-cols-2 gap-2 items-center">
                <Label className="text-xs">{label}</Label>
                <Input
                  className="h-7 text-xs"
                  placeholder={placeholder}
                  value={colMapForm[key] ?? ""}
                  onChange={e => setColMapForm(f => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setColMapOpen(false)}>Cancel</Button>
            <Button onClick={() => saveColMap.mutate(colMapForm)} disabled={saveColMap.isPending}>
              {saveColMap.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete headshots confirm */}
      <Dialog open={deleteHsOpen} onOpenChange={setDeleteHsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete headshots</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete all candidate headshots for <strong>{selectedCycle?.name}</strong> from R2 storage and clear their headshot URLs. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteHsOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => purgeHeadshots.mutate()} disabled={purgeHeadshots.isPending}>
              {purgeHeadshots.isPending ? "Deleting…" : "Delete headshots"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Round dialog */}
      <Dialog open={newRoundOpen} onOpenChange={setNewRoundOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Interview Round</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Round name</Label>
              <Input
                placeholder="e.g. Round 1"
                value={newRoundForm.name}
                onChange={e => setNewRoundForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Round #</Label>
                <Input
                  type="number"
                  className="h-8 text-sm"
                  value={newRoundForm.round_number}
                  onChange={e => setNewRoundForm(f => ({ ...f, round_number: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Score format</Label>
                <select
                  className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                  value={newRoundForm.score_format}
                  onChange={e => setNewRoundForm(f => ({ ...f, score_format: e.target.value }))}
                >
                  <option value="numeric">Numeric (0–5)</option>
                  <option value="ynm">Y/M/N</option>
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewRoundOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createRound.mutate(newRoundForm)}
              disabled={!newRoundForm.name.trim() || createRound.isPending}
            >
              {createRound.isPending ? "Creating…" : "Create round"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sheet dialog */}
      <Dialog open={sheetDialogOpen} onOpenChange={(o) => { setSheetDialogOpen(o); if (!o) setSheetSaved(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" /> Connect Application Sheet
            </DialogTitle>
          </DialogHeader>
          {sheetSaved ? (
            <div className="py-6 text-center space-y-2">
              <Check className="h-8 w-8 text-emerald-500 mx-auto" />
              <p className="text-sm font-medium">Sheet URL saved!</p>
              <p className="text-xs text-muted-foreground">
                Full import — pulling candidates directly from the sheet — is coming soon.
                For now you can open the sheet to reference it.
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Google Sheet URL</Label>
                <Input
                  placeholder="https://docs.google.com/spreadsheets/d/…"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Paste the full URL from your application spreadsheet. Import functionality is coming soon.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSheetDialogOpen(false); setSheetSaved(false); }}>
              {sheetSaved ? "Close" : "Cancel"}
            </Button>
            {!sheetSaved && (
              <Button onClick={() => saveSheetUrl.mutate()} disabled={!sheetUrl.trim() || saveSheetUrl.isPending}>
                {saveSheetUrl.isPending ? "Saving…" : "Save"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NewCycleDialog({
  open, onOpenChange, form, setForm, onSubmit, isPending, error,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  form: { name: string; sheet_url: string };
  setForm: (f: { name: string; sheet_url: string }) => void;
  onSubmit: () => void;
  isPending: boolean;
  error?: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Recruitment Cycle</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Cycle name</Label>
            <Input
              placeholder="e.g. Fall 2025"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter" && form.name.trim()) onSubmit(); }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>
              Application sheet URL{" "}
              <span className="text-xs text-muted-foreground font-normal">(optional — can add later)</span>
            </Label>
            <Input
              placeholder="https://docs.google.com/spreadsheets/d/…"
              value={form.sheet_url}
              onChange={(e) => setForm({ ...form, sheet_url: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Link your Google Sheet with application responses. Import is coming soon.
            </p>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSubmit} disabled={!form.name.trim() || isPending}>
            {isPending ? "Creating…" : "Create cycle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
