"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Search, Plus, FileSpreadsheet, ChevronRight, Users, Check, ExternalLink, FileDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/recruitment/StatusBadge";
import { createApi } from "@/lib/api";
import type { ApplicationCycle, Candidate, CandidateStatus } from "@cba/types";

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

export default function RecruitmentPage() {
  const { data: session } = useSession();
  const api = () => createApi(session?.accessToken);
  const qc = useQueryClient();

  const canManage = session?.role === "recruitment" || session?.role === "eboard";

  const [selectedCycleId, setSelectedCycleId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // New cycle dialog
  const [newCycleOpen, setNewCycleOpen] = useState(false);
  const [newCycleForm, setNewCycleForm] = useState({ name: "", sheet_url: "" });

  // Sheet dialog (placeholder)
  const [sheetDialogOpen, setSheetDialogOpen] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [sheetSaved, setSheetSaved] = useState(false);

  const { data: cycles = [], isLoading: cyclesLoading } = useQuery<ApplicationCycle[]>({
    queryKey: ["app-cycles"],
    queryFn: () => api().get("/ops/v1/cycles"),
    enabled: !!session?.accessToken,
  });

  // Auto-select active cycle (or first) on load
  useEffect(() => {
    if (selectedCycleId || cycles.length === 0) return;
    const active = cycles.find((c) => c.is_active) ?? cycles[0];
    setSelectedCycleId(active.id);
  }, [cycles, selectedCycleId]);

  const selectedCycle = cycles.find((c) => c.id === selectedCycleId) ?? null;

  const { data: candidates = [], isLoading: candidatesLoading } = useQuery<Candidate[]>({
    queryKey: ["candidates", selectedCycleId],
    queryFn: () => api().get(`/ops/v1/candidates?cycle_id=${selectedCycleId}`),
    enabled: !!session?.accessToken && !!selectedCycleId,
  });

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
                  href={selectedCycle.sheet_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-emerald-700 hover:underline ml-1"
                >
                  Open sheet <ExternalLink className="h-3 w-3" />
                </a>
                <div className="ml-auto flex items-center gap-2">
                  <Button size="sm" variant="outline" className="h-7 text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                    onClick={() => { setSheetUrl(selectedCycle.sheet_url ?? ""); setSheetSaved(false); setSheetDialogOpen(true); }}>
                    Update sheet
                  </Button>
                  <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" disabled>
                    Import candidates <span className="ml-1 opacity-60 text-[10px]">coming soon</span>
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
