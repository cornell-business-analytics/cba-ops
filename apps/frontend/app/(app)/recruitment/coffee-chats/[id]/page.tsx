"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useAppSession } from "@/hooks/session-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Send, X, Settings, Check, RotateCcw, RefreshCw, Search, UserRound, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createApi } from "@/lib/api";
import type { MembershipDetail } from "@cba/types";

interface ColMap {
  name_col: string;
  email_col: string;
  grad_col: string;
  major_col: string;
  interest_col: string;
  request_col: string;
  timestamp_col: string;
}

interface Evaluation {
  id: string;
  cycle_id: string;
  applicant_name: string;
  applicant_email: string;
  member_name: string;
  chat_date: string | null;
  score: number | null;
  comments: string | null;
}

interface CycleExclusion {
  id: string;
  membership_id: string;
  member_name: string;
}

interface AutoPairSuggestion {
  applicant_id: string;
  applicant_name: string;
  applicant_major: string | null;
  applicant_grad_date: string | null;
  applicant_interests: string | null;
  applicant_requested: string | null;
  membership_id: string;
  member_name: string;
  member_major: string | null;
  member_grad_year: string | null;
  score: number;
}

interface AutoPairWeights {
  requested_match: number;
  major_similarity: number;
  interest_overlap: number;
  load_balance: number;
}

interface Cycle {
  id: string;
  name: string;
  sheet_id: string | null;
  evaluation_sheet_id: string | null;
  sender_name: string;
  sender_title: string;
  pairing_subject: string;
  pairing_body: string;
  rejection_subject: string;
  rejection_body: string;
  is_active: boolean;
  column_mapping: ColMap;
}

interface Applicant {
  id: string;
  name: string;
  email: string;
  netid: string;
  grad_date: string | null;
  major: string | null;
  fields_of_interest: string | null;
  requested_member_raw: string | null;
  notes: string | null;
  paired_membership_id: string | null;
  paired_member_name: string | null;
  pairing_status: string;
  gmail_message_id: string | null;
  sent_at: string | null;
}

function gradDateToYear(gradDate: string | null): string {
  if (!gradDate) return "";
  const now = new Date();
  const academicYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  const s = gradDate.trim();
  if (/^\d{4}$/.test(s)) {
    const delta = parseInt(s) - academicYear;
    return ({ 1: "senior", 2: "junior", 3: "sophomore", 4: "freshman" } as Record<number, string>)[delta] ?? s;
  }
  for (const [season, offset] of Object.entries({ Spring: 0, Fall: -1 } as Record<string, number>)) {
    if (s.startsWith(season)) {
      const year = parseInt(s.split(" ").pop() ?? "0") + offset;
      const delta = year - academicYear;
      return ({ 1: "senior", 2: "junior", 3: "sophomore", 4: "freshman" } as Record<number, string>)[delta] ?? s;
    }
  }
  return s;
}

const STATUS_BADGE: Record<string, "outline" | "warning" | "success" | "destructive"> = {
  unpaired: "outline",
  paired: "warning",
  sent: "success",
  rejected: "destructive",
  needs_attention: "destructive",
};

function statusLabel(s: string) {
  return s === "needs_attention" ? "attention" : s;
}

const DEFAULT_COL_MAP: ColMap = {
  name_col: "Full Name",
  email_col: "Cornell Email Address",
  grad_col: "Graduation Date",
  major_col: "Intended Major(s)",
  interest_col: "Fields of Interest",
  request_col: "Paired Member",
  timestamp_col: "Timestamp",
};

export default function CycleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const session = useAppSession();
  const router = useRouter();
  const qc = useQueryClient();
  const api = createApi(session?.accessToken);

  const canManageRecruitment = session?.role === "recruitment" || session?.role === "eboard" || session?.role === "director";

  const [activeTab, setActiveTab] = useState<"applicants" | "participants" | "evaluations">("applicants");
  const [evalSearch, setEvalSearch] = useState("");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsForm, setSettingsForm] = useState<Partial<Cycle & { column_mapping: ColMap }>>({});
  const [confirmDialog, setConfirmDialog] = useState<{
    applicantId: string; applicantName: string; action: "send" | "reject" | "reset" | "delete";
  } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Member picker dialog
  const [pickerApplicant, setPickerApplicant] = useState<{ id: string; name: string } | null>(null);
  const [memberSearch, setMemberSearch] = useState("");

  // Sync state shown in header
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const autoImportedRef = useRef(false);

  // Evaluation import state
  const [evalSyncStatus, setEvalSyncStatus] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [evalSyncMsg, setEvalSyncMsg] = useState<string | null>(null);

  // Participants state
  const [participantSearch, setParticipantSearch] = useState("");

  // Auto-pair dialog state
  const [autoPairOpen, setAutoPairOpen] = useState(false);
  const [autoPairPreset, setAutoPairPreset] = useState("balanced");
  const [autoPairWeights, setAutoPairWeights] = useState<AutoPairWeights>({
    requested_match: 1.0,
    major_similarity: 0.4,
    interest_overlap: 0.3,
    load_balance: 0.2,
  });
  const [autoPairPreview, setAutoPairPreview] = useState<AutoPairSuggestion[] | null>(null);
  const [autoPairError, setAutoPairError] = useState<string | null>(null);
  const [excludedMemberIds, setExcludedMemberIds] = useState<Set<string>>(new Set());

  const { data: cycle } = useQuery<Cycle>({
    queryKey: ["cycle", id],
    queryFn: () => api.get<Cycle[]>(`/ops/v1/recruitment/cycles`).then((cs) => cs.find(c => c.id === id)!),
    enabled: !!session?.accessToken,
    staleTime: 60_000,
  });

  const { data: applicants = [], isLoading } = useQuery<Applicant[]>({
    queryKey: ["applicants", id],
    queryFn: () => api.get<Applicant[]>(`/ops/v1/recruitment/cycles/${id}/applicants`),
    enabled: !!session?.accessToken,
  });

  const { data: members = [] } = useQuery<MembershipDetail[]>({
    queryKey: ["members"],
    queryFn: () => api.get<MembershipDetail[]>("/ops/v1/members"),
    enabled: !!session?.accessToken,
    staleTime: 5 * 60_000,
  });

  const { data: sheetCols } = useQuery<{ columns: string[] }>({
    queryKey: ["sheet-cols", id],
    queryFn: () => api.get<{ columns: string[] }>(`/ops/v1/recruitment/cycles/${id}/sheet-columns`),
    enabled: !!session?.accessToken && settingsOpen && !!cycle?.sheet_id,
  });

  const { data: evaluations = [] } = useQuery<Evaluation[]>({
    queryKey: ["evaluations", id],
    queryFn: () => api.get<Evaluation[]>(`/ops/v1/recruitment/cycles/${id}/evaluations`),
    enabled: !!session?.accessToken,
  });

  const { data: exclusions = [] } = useQuery<CycleExclusion[]>({
    queryKey: ["participants", id],
    queryFn: () => api.get<CycleExclusion[]>(`/ops/v1/recruitment/cycles/${id}/participants`),
    enabled: !!session?.accessToken,
  });

  const activeMembers = members.filter(m => m.is_active);

  const evalImportMutation = useMutation({
    mutationFn: () => api.post<{ imported: number; updated: number; skipped: number; missing_cols: string[] }>(`/ops/v1/recruitment/cycles/${id}/evaluations/import`, {}),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["evaluations", id] });
      setEvalSyncStatus("done");
      const parts: string[] = [];
      if (data.imported > 0) parts.push(`${data.imported} new`);
      if (data.updated > 0) parts.push(`${data.updated} updated`);
      if (data.skipped > 0) parts.push(`${data.skipped} skipped`);
      setEvalSyncMsg(parts.length ? parts.join(", ") : "Up to date");
      if (data.missing_cols.length > 0) {
        setEvalSyncMsg(prev => `${prev} · missing cols: ${data.missing_cols.join(", ")}`);
      }
    },
    onError: (err: Error) => {
      setEvalSyncStatus("error");
      setEvalSyncMsg(err.message);
    },
  });

  const excludeMember = useMutation({
    mutationFn: (membership_id: string) =>
      api.post<CycleExclusion>(`/ops/v1/recruitment/cycles/${id}/participants`, { membership_id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["participants", id] }),
  });

  const includeMember = useMutation({
    mutationFn: (membership_id: string) =>
      api.delete<void>(`/ops/v1/recruitment/cycles/${id}/participants/${membership_id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["participants", id] }),
  });

  const previewAutoPair = useMutation({
    mutationFn: (payload: { weights: AutoPairWeights; excluded_membership_ids: string[] }) =>
      api.post<AutoPairSuggestion[]>(`/ops/v1/recruitment/cycles/${id}/auto-pair?preview=true`, payload),
    onSuccess: (data) => {
      setAutoPairPreview(data);
      setAutoPairError(null);
      setAutoPairOpen(false);   // close modal → show inline in table
      setActiveTab("applicants");
    },
    onError: (err: Error) => setAutoPairError(err.message),
  });

  // Stores the last-used payload so Apply can re-use it without re-opening the modal
  const [lastAutoPairPayload, setLastAutoPairPayload] = useState<{ weights: AutoPairWeights; excluded_membership_ids: string[] } | null>(null);

  const applyAutoPair = useMutation({
    mutationFn: (payload: { weights: AutoPairWeights; excluded_membership_ids: string[] }) =>
      api.post<AutoPairSuggestion[]>(`/ops/v1/recruitment/cycles/${id}/auto-pair`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["applicants", id] });
      qc.invalidateQueries({ queryKey: ["participants", id] });
      setAutoPairPreview(null);
      setLastAutoPairPayload(null);
      setAutoPairError(null);
    },
    onError: (err: Error) => setAutoPairError(err.message),
  });

  const importMutation = useMutation({
    mutationFn: () => api.post<{ imported: number; skipped: number; missing_cols: string[] }>(`/ops/v1/recruitment/cycles/${id}/import`, {}),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["applicants", id] });
      setSyncStatus("done");
      const parts: string[] = [];
      if (data.imported > 0) parts.push(`${data.imported} new`);
      if (data.skipped > 0) parts.push(`${data.skipped} skipped`);
      setSyncMsg(parts.length ? parts.join(", ") : "Up to date");
      if (data.missing_cols.length > 0) {
        setSyncMsg(prev => `${prev} · missing cols: ${data.missing_cols.join(", ")}`);
      }
    },
    onError: (err: Error) => {
      setSyncStatus("error");
      setSyncMsg(err.message);
    },
  });

  // Auto-import once when cycle loads and has a sheet_id — only if Gmail is connected
  const { data: gmailStatus } = useQuery<{ connected: boolean; account_email: string | null }>({
    queryKey: ["gmail-status"],
    queryFn: () => api.get("/ops/v1/recruitment/gmail-status"),
    enabled: !!session?.accessToken,
  });

  useEffect(() => {
    if (!cycle || !cycle.sheet_id || autoImportedRef.current || !session?.accessToken) return;
    if (!gmailStatus) return; // wait for status to load
    if (!gmailStatus.connected) return; // skip silently if no Gmail connected
    autoImportedRef.current = true;
    setSyncStatus("syncing");
    setSyncMsg(null);
    importMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycle?.id, cycle?.sheet_id, session?.accessToken, gmailStatus?.connected]);

  const pairMutation = useMutation({
    mutationFn: ({ applicantId, membershipId }: { applicantId: string; membershipId: string | null }) =>
      membershipId
        ? api.patch<unknown>(`/ops/v1/recruitment/cycles/${id}/applicants/${applicantId}/pairing`, { membership_id: membershipId })
        : api.delete<unknown>(`/ops/v1/recruitment/cycles/${id}/applicants/${applicantId}/pairing`),
    onMutate: async ({ applicantId, membershipId }) => {
      await qc.cancelQueries({ queryKey: ["applicants", id] });
      const prev = qc.getQueryData<Applicant[]>(["applicants", id]);
      qc.setQueryData<Applicant[]>(["applicants", id], (old = []) =>
        old.map(a => a.id !== applicantId ? a : {
          ...a,
          paired_membership_id: membershipId,
          paired_member_name: membershipId
            ? (members.find(m => m.id === membershipId)?.user_name ?? null)
            : null,
          pairing_status: membershipId ? "paired" : "unpaired",
        })
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["applicants", id], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["applicants", id] }),
  });

  const sendPairing = useMutation({
    mutationFn: (applicantId: string) =>
      api.post<void>(`/ops/v1/recruitment/cycles/${id}/applicants/${applicantId}/send-pairing-email`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["applicants", id] }); setConfirmDialog(null); setActionError(null); },
    onError: (err: Error) => { setActionError(`Failed to send: ${err.message}`); },
  });

  const markSent = useMutation({
    mutationFn: (applicantId: string) =>
      api.post<void>(`/ops/v1/recruitment/cycles/${id}/applicants/${applicantId}/mark-sent`, {}),
    onMutate: async (applicantId) => {
      await qc.cancelQueries({ queryKey: ["applicants", id] });
      const prev = qc.getQueryData<Applicant[]>(["applicants", id]);
      qc.setQueryData<Applicant[]>(["applicants", id], (old = []) =>
        old.map(a => a.id !== applicantId ? a : { ...a, pairing_status: "sent" })
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["applicants", id], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["applicants", id] }),
  });

  const sendRejection = useMutation({
    mutationFn: (applicantId: string) =>
      api.post<void>(`/ops/v1/recruitment/cycles/${id}/applicants/${applicantId}/send-rejection-email`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["applicants", id] }); setConfirmDialog(null); setActionError(null); },
    onError: (err: Error) => { setActionError(`Failed to send rejection: ${err.message}`); },
  });

  const resetStatus = useMutation({
    mutationFn: (applicantId: string) =>
      api.post<void>(`/ops/v1/recruitment/cycles/${id}/applicants/${applicantId}/reset-status`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["applicants", id] }); setConfirmDialog(null); setActionError(null); },
    onError: (err: Error) => { setActionError(`Failed to reset: ${err.message}`); },
  });

  const deleteApplicant = useMutation({
    mutationFn: (applicantId: string) =>
      api.delete<void>(`/ops/v1/recruitment/cycles/${id}/applicants/${applicantId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["applicants", id] }); setConfirmDialog(null); setActionError(null); },
    onError: (err: Error) => { setActionError(`Failed to delete: ${err.message}`); },
  });

  const updateCycle = useMutation({
    mutationFn: (data: Partial<Cycle>) => api.patch<Cycle>(`/ops/v1/recruitment/cycles/${id}`, {
      name: data.name,
      sheet_id: data.sheet_id,
      evaluation_sheet_id: data.evaluation_sheet_id,
      sender_title: data.sender_title,
      pairing_subject: data.pairing_subject,
      pairing_body: data.pairing_body,
      rejection_subject: data.rejection_subject,
      rejection_body: data.rejection_body,
      column_mapping: data.column_mapping,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cycle", id] });
      qc.invalidateQueries({ queryKey: ["coffee-chat-cycles"] });
      setSettingsError(null);
      setSettingsOpen(false);
    },
    onError: (err: Error) => setSettingsError(err.message),
  });

  const handleOpenSettings = () => {
    setSettingsForm({
      ...(cycle ?? {}),
      column_mapping: cycle?.column_mapping ?? DEFAULT_COL_MAP,
    });
    setSettingsOpen(true);
  };

  const handleConfirm = () => {
    if (!confirmDialog) return;
    setActionError(null);
    if (confirmDialog.action === "send") sendPairing.mutate(confirmDialog.applicantId);
    else if (confirmDialog.action === "reject") sendRejection.mutate(confirmDialog.applicantId);
    else if (confirmDialog.action === "reset") resetStatus.mutate(confirmDialog.applicantId);
    else if (confirmDialog.action === "delete") deleteApplicant.mutate(confirmDialog.applicantId);
  };

  const handleManualSync = () => {
    setSyncStatus("syncing");
    setSyncMsg(null);
    importMutation.mutate();
  };

  const isPending = sendPairing.isPending || sendRejection.isPending || resetStatus.isPending || deleteApplicant.isPending;

  const unpairedCount = applicants.filter(a => a.pairing_status === "unpaired").length;
  const sentCount = applicants.filter(a => a.pairing_status === "sent").length;

  // How many times each person has submitted a request this cycle (by email)
  const requestCounts = applicants.reduce<Record<string, number>>((acc, a) => {
    const key = a.email.toLowerCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const memberEmailCounts = applicants.reduce<Record<string, number>>((acc, a) => {
    if (a.paired_membership_id && (a.pairing_status === "paired" || a.pairing_status === "sent")) {
      acc[a.paired_membership_id] = (acc[a.paired_membership_id] || 0) + 1;
    }
    return acc;
  }, {});

  const colMapForm = (settingsForm.column_mapping ?? DEFAULT_COL_MAP);
  const suggestionMap = new Map(autoPairPreview?.map(s => [s.applicant_id, s]) ?? []);

  return (
    <div className="p-6 space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/recruitment/coffee-chats")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-semibold">{cycle?.name ?? "Loading…"}</h1>
            <p className="text-sm text-muted-foreground">
              {applicants.length} applicants · {sentCount} sent · {unpairedCount} unpaired
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Applicant sync indicator */}
          {cycle?.sheet_id && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {syncStatus === "syncing" && (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  <span>Syncing…</span>
                </>
              )}
              {syncStatus === "done" && (
                <>
                  <Check className="h-3 w-3 text-green-600" />
                  <span className="text-green-700">{syncMsg}</span>
                  <button onClick={handleManualSync} className="ml-1 hover:text-foreground" title="Re-sync">
                    <RefreshCw className="h-3 w-3" />
                  </button>
                </>
              )}
              {syncStatus === "error" && (
                <>
                  <span className="text-destructive">{syncMsg}</span>
                  <button onClick={handleManualSync} className="ml-1 hover:text-foreground" title="Retry">
                    <RefreshCw className="h-3 w-3" />
                  </button>
                </>
              )}
              {syncStatus === "idle" && null}
            </div>
          )}
          {/* Eval import button + status */}
          {cycle?.evaluation_sheet_id && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {evalSyncStatus === "syncing" && (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  <span>Importing evals…</span>
                </>
              )}
              {evalSyncStatus === "done" && (
                <>
                  <Check className="h-3 w-3 text-green-600" />
                  <span className="text-green-700">{evalSyncMsg}</span>
                </>
              )}
              {evalSyncStatus === "error" && (
                <span className="text-destructive">{evalSyncMsg}</span>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={evalImportMutation.isPending}
                onClick={() => {
                  setEvalSyncStatus("syncing");
                  setEvalSyncMsg(null);
                  evalImportMutation.mutate();
                }}
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${evalImportMutation.isPending ? "animate-spin" : ""}`} />
                Import evals
              </Button>
            </div>
          )}
          <Button size="sm" variant="outline" onClick={handleOpenSettings}>
            <Settings className="h-4 w-4 mr-1" /> Settings
          </Button>
          {!cycle?.sheet_id && (
            <Button size="sm" variant="outline" onClick={handleOpenSettings}>
              Add Sheet ID to import
            </Button>
          )}
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 border-b">
        {([
          { key: "applicants", label: `Applicants (${applicants.length})` },
          { key: "participants", label: exclusions.length > 0 ? `Participants (${exclusions.length} excluded)` : "Participants" },
          { key: "evaluations", label: `Evaluations (${evaluations.length})` },
        ] as { key: "applicants" | "participants" | "evaluations"; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === key
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Applicant table */}
      {activeTab === "applicants" && <>
        <div className="flex items-center gap-2">
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue placeholder="All years" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All years</SelectItem>
              <SelectItem value="freshman">Freshman</SelectItem>
              <SelectItem value="sophomore">Sophomore</SelectItem>
              <SelectItem value="junior">Junior</SelectItem>
              <SelectItem value="senior">Senior</SelectItem>
            </SelectContent>
          </Select>
          {yearFilter !== "all" && (
            <span className="text-xs text-muted-foreground">
              {applicants.filter(a => gradDateToYear(a.grad_date) === yearFilter).length} applicants
            </span>
          )}
          <div className="ml-auto">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5"
              onClick={() => { setAutoPairPreview(null); setAutoPairError(null); setExcludedMemberIds(new Set()); setAutoPairOpen(true); }}
            >
              <Wand2 className="h-3.5 w-3.5" /> Auto-Pair
            </Button>
          </div>
        </div>
        {/* Auto-pair inline preview banner */}
        {autoPairPreview && (
          <div className="flex items-center gap-3 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm">
            <Wand2 className="h-4 w-4 text-violet-600 shrink-0" />
            <span className="text-violet-800 font-medium">
              {autoPairPreview.length} suggested pair{autoPairPreview.length !== 1 ? "s" : ""} — review below, then apply or discard.
            </span>
            {autoPairPreview.length < applicants.filter(a => a.pairing_status === "unpaired").length && (
              <span className="text-xs text-amber-700 bg-amber-100 rounded px-1.5 py-0.5">
                {applicants.filter(a => a.pairing_status === "unpaired").length - autoPairPreview.length} could not be paired
              </span>
            )}
            <div className="ml-auto flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => { setAutoPairPreview(null); setLastAutoPairPayload(null); }}
              >
                Discard
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs bg-violet-600 hover:bg-violet-700"
                disabled={applyAutoPair.isPending}
                onClick={() => lastAutoPairPayload && applyAutoPair.mutate(lastAutoPairPayload)}
              >
                {applyAutoPair.isPending ? "Applying…" : "Apply All"}
              </Button>
            </div>
          </div>
        )}

        <div className="rounded-lg border bg-white overflow-x-auto">
        {isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading applicants…</p>
        ) : applicants.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            {cycle?.sheet_id
              ? syncStatus === "syncing"
                ? "Syncing from sheet…"
                : "No applicants yet. Check that the sheet is shared with the connected Gmail account."
              : "No applicants yet. Add a Sheet ID in Settings to auto-import."}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                {["Applicant", "Major / Grad", "Interests", "Requested", "Paired Member", "Status", "Actions"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {applicants.filter(a => yearFilter === "all" || gradDateToYear(a.grad_date) === yearFilter).map((a) => {
                const suggestion = suggestionMap.get(a.id);
                return (
                <tr key={a.id} className={suggestion ? "bg-violet-50/60 hover:bg-violet-50" : "hover:bg-muted/10"}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium">{a.name}</p>
                      {(requestCounts[a.email.toLowerCase()] ?? 1) > 1 && (
                        <span className="text-xs font-medium text-amber-700 bg-amber-100 rounded px-1 py-0.5">
                          ×{requestCounts[a.email.toLowerCase()]}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{a.netid}@cornell.edu</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    <p>{a.major ?? "—"}</p>
                    <p>{a.grad_date ?? ""}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[180px]">
                    {a.fields_of_interest || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {a.requested_member_raw || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {suggestion && a.pairing_status === "unpaired" ? (
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <Wand2 className="h-3 w-3 text-violet-500 shrink-0" />
                          <span className="text-sm font-medium text-violet-800">{suggestion.member_name}</span>
                        </div>
                        {suggestion.member_major && <p className="text-xs text-violet-600/70 pl-4">{suggestion.member_major}</p>}
                        <p className="text-xs text-violet-400 pl-4 tabular-nums">score {suggestion.score.toFixed(2)}</p>
                      </div>
                    ) : a.pairing_status === "sent" || a.pairing_status === "rejected" ? (
                      <span className="text-sm text-muted-foreground">{a.paired_member_name ?? "—"}</span>
                    ) : (
                      <button
                        onClick={() => { setPickerApplicant({ id: a.id, name: a.name }); setMemberSearch(""); }}
                        className="h-8 max-w-44 truncate rounded-md border border-input bg-background px-3 text-xs text-left hover:bg-muted/50 transition-colors"
                      >
                        {a.paired_member_name ?? <span className="text-muted-foreground">Assign member…</span>}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_BADGE[a.pairing_status] ?? "outline"}>
                      {statusLabel(a.pairing_status)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {a.pairing_status === "paired" && (
                        <>
                          <Button size="sm" className="h-7 text-xs"
                            onClick={() => setConfirmDialog({ applicantId: a.id, applicantName: a.name, action: "send" })}>
                            <Send className="h-3 w-3 mr-1" /> Send
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs"
                            title="Mark as sent without emailing"
                            onClick={() => markSent.mutate(a.id)}>
                            <Check className="h-3 w-3 mr-1" /> Mark sent
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs text-destructive hover:text-destructive"
                            onClick={() => setConfirmDialog({ applicantId: a.id, applicantName: a.name, action: "reject" })}>
                            <X className="h-3 w-3 mr-1" /> Reject
                          </Button>
                        </>
                      )}
                      {a.pairing_status === "unpaired" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs text-destructive hover:text-destructive"
                          onClick={() => setConfirmDialog({ applicantId: a.id, applicantName: a.name, action: "reject" })}>
                          <X className="h-3 w-3 mr-1" /> Reject
                        </Button>
                      )}
                      {a.pairing_status === "sent" && (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <Check className="h-3 w-3" /> Sent
                        </span>
                      )}
                      {a.pairing_status === "rejected" && (
                        <span className="text-xs text-muted-foreground">Rejected</span>
                      )}
                      {canManageRecruitment && (a.pairing_status === "sent" || a.pairing_status === "rejected") && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
                          title="Reset status to re-send"
                          onClick={() => setConfirmDialog({ applicantId: a.id, applicantName: a.name, action: "reset" })}>
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      )}
                      {canManageRecruitment && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive"
                          title="Delete entry"
                          onClick={() => setConfirmDialog({ applicantId: a.id, applicantName: a.name, action: "delete" })}>
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        )}
      </div>
      </>}

      {/* Participants tab */}
      {activeTab === "participants" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                All active members are included in auto-pairing by default. Exclude specific members below.
              </p>
              {exclusions.length > 0 && (
                <p className="text-xs text-amber-700 mt-0.5">{exclusions.length} member{exclusions.length !== 1 ? "s" : ""} excluded</p>
              )}
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8 h-9 w-60"
                placeholder="Search members…"
                value={participantSearch}
                onChange={(e) => setParticipantSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="rounded-lg border bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {["Member", "Major", "Grad Year", "Status", ""].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {activeMembers
                  .filter(m => {
                    const q = participantSearch.toLowerCase();
                    return !q || m.user_name.toLowerCase().includes(q) || (m.major ?? "").toLowerCase().includes(q);
                  })
                  .map(m => {
                    const excl = exclusions.find(e => e.membership_id === m.id);
                    return (
                      <tr key={m.id} className={`hover:bg-muted/10 ${excl ? "opacity-60" : ""}`}>
                        <td className="px-4 py-3 font-medium">{m.user_name}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{m.major ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{m.grad_year ?? "—"}</td>
                        <td className="px-4 py-3">
                          {excl ? (
                            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">Excluded</span>
                          ) : (
                            <span className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-0.5">Included</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {excl ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              disabled={includeMember.isPending}
                              onClick={() => includeMember.mutate(m.id)}
                            >
                              Include
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-muted-foreground hover:text-destructive"
                              disabled={excludeMember.isPending}
                              onClick={() => excludeMember.mutate(m.id)}
                            >
                              Exclude
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Evaluations table */}
      {activeTab === "evaluations" && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8 h-9"
                placeholder="Search applicant or member…"
                value={evalSearch}
                onChange={(e) => setEvalSearch(e.target.value)}
              />
            </div>
            {evaluations.length > 0 && (
              <p className="text-xs text-muted-foreground">
                avg score: {(evaluations.filter(e => e.score !== null).reduce((s, e) => s + (e.score ?? 0), 0) / (evaluations.filter(e => e.score !== null).length || 1)).toFixed(1)} / {evaluations.filter(e => e.score !== null).length} rated
              </p>
            )}
          </div>
          {evaluations.length === 0 ? (
            <div className="rounded-lg border border-dashed p-12 text-center">
              <p className="text-sm text-muted-foreground">
                {cycle?.evaluation_sheet_id
                  ? "No evaluations imported yet. Click \"Import evals\" above."
                  : "No evaluations yet. Add an Evaluation Sheet ID in Settings, then import."}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border bg-white overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {["Applicant", "Member", "Date", "Score", "Comments"].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {evaluations
                    .filter(e => {
                      const q = evalSearch.toLowerCase();
                      return !q
                        || e.applicant_name.toLowerCase().includes(q)
                        || e.applicant_email.toLowerCase().includes(q)
                        || e.member_name.toLowerCase().includes(q);
                    })
                    .map(e => (
                      <tr key={e.id} className="hover:bg-muted/10">
                        <td className="px-4 py-3">
                          <p className="font-medium">{e.applicant_name}</p>
                          <p className="text-xs text-muted-foreground">{e.applicant_email}</p>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{e.member_name}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{e.chat_date ?? "—"}</td>
                        <td className="px-4 py-3">
                          {e.score !== null ? (
                            <span className={`inline-block font-semibold text-sm px-2 py-0.5 rounded ${
                              e.score >= 4 ? "bg-green-100 text-green-800"
                              : e.score >= 3 ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                            }`}>{e.score}</span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs">
                          {e.comments ?? "—"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Action confirm dialog */}
      <Dialog open={!!confirmDialog} onOpenChange={(o) => { if (!o) { setConfirmDialog(null); setActionError(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {confirmDialog?.action === "send" && "Send pairing email"}
              {confirmDialog?.action === "reject" && "Send rejection email"}
              {confirmDialog?.action === "reset" && "Reset email status"}
              {confirmDialog?.action === "delete" && "Delete entry"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {confirmDialog?.action === "send" && `Send pairing email to ${confirmDialog.applicantName}? This will CC the paired member.`}
            {confirmDialog?.action === "reject" && `Send a rejection email to ${confirmDialog?.applicantName}?`}
            {confirmDialog?.action === "reset" && `Reset status for ${confirmDialog?.applicantName}? This allows re-sending an email.`}
            {confirmDialog?.action === "delete" && `Permanently delete ${confirmDialog?.applicantName}'s entry? This cannot be undone.`}
          </p>
          {actionError && <p className="text-sm text-destructive">{actionError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmDialog(null); setActionError(null); }}>Cancel</Button>
            <Button
              variant={confirmDialog?.action === "reject" || confirmDialog?.action === "delete" ? "destructive" : "default"}
              onClick={handleConfirm}
              disabled={isPending}
            >
              {isPending ? "Working…" : confirmDialog?.action === "send" ? "Send email" : confirmDialog?.action === "reject" ? "Send rejection" : confirmDialog?.action === "delete" ? "Delete" : "Reset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Member picker dialog */}
      <Dialog open={!!pickerApplicant} onOpenChange={(o) => { if (!o) setPickerApplicant(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-5 pt-5 pb-3 border-b">
            <DialogTitle className="text-base">
              Assign member{pickerApplicant ? ` — ${pickerApplicant.name}` : ""}
            </DialogTitle>
            <div className="relative mt-2">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                className="pl-8 h-9"
                placeholder="Search by name, major…"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
              />
            </div>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 p-4">
            <div className="grid grid-cols-2 gap-3">
              {activeMembers
                .slice()
                .sort((a, b) => (memberEmailCounts[a.id] ?? 0) - (memberEmailCounts[b.id] ?? 0))
                .filter((m) => {
                  const q = memberSearch.toLowerCase();
                  return !q
                    || m.user_name.toLowerCase().includes(q)
                    || (m.major ?? "").toLowerCase().includes(q);
                })
                .map((m) => {
                  const count = memberEmailCounts[m.id] ?? 0;
                  const isSelected = pickerApplicant
                    && applicants.find(a => a.id === pickerApplicant.id)?.paired_membership_id === m.id;
                  const profText = m.professional_is_interests
                    ? m.professional_experience
                    : m.professional_experience;
                  const profLabel = m.professional_is_interests ? "Interests" : "Experience";

                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        pairMutation.mutate({ applicantId: pickerApplicant!.id, membershipId: m.id });
                        setPickerApplicant(null);
                      }}
                      className={`text-left rounded-lg border p-3 transition-colors hover:border-foreground/40 hover:bg-muted/30 ${
                        isSelected ? "border-foreground bg-muted/20" : "border-border"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {m.headshot_url ? (
                          <Image
                            src={m.headshot_url}
                            alt=""
                            width={40}
                            height={40}
                            unoptimized
                            className="rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <UserRound className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{m.user_name}</p>
                            <span className={`shrink-0 text-xs font-medium rounded px-1.5 py-0.5 ${
                              count >= 3 ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"
                            }`}>
                              {count} assigned
                            </span>
                          </div>
                          {(m.major || m.grad_year) && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {[m.major, m.grad_year ? `'${m.grad_year.slice(-2)}` : null].filter(Boolean).join(" · ")}
                            </p>
                          )}
                          {profText && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              <span className="font-medium text-foreground/60">{profLabel}: </span>
                              {profText}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>
            {memberSearch && activeMembers.filter(m =>
              m.user_name.toLowerCase().includes(memberSearch.toLowerCase()) ||
              (m.major ?? "").toLowerCase().includes(memberSearch.toLowerCase())
            ).length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">No members match your search.</p>
            )}
          </div>

          <DialogFooter className="px-5 py-3 border-t">
            {pickerApplicant && applicants.find(a => a.id === pickerApplicant.id)?.paired_membership_id && (
              <Button
                variant="outline"
                className="mr-auto text-destructive hover:text-destructive"
                onClick={() => {
                  pairMutation.mutate({ applicantId: pickerApplicant.id, membershipId: null });
                  setPickerApplicant(null);
                }}
              >
                <X className="h-4 w-4 mr-1" /> Unassign
              </Button>
            )}
            <Button variant="outline" onClick={() => setPickerApplicant(null)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auto-Pair dialog */}
      <Dialog open={autoPairOpen} onOpenChange={(o) => { if (!o) { setAutoPairOpen(false); setAutoPairPreview(null); setAutoPairError(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-5 pt-5 pb-3 border-b">
            <DialogTitle>Auto-Pair Applicants</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Pairs unpaired applicants with opted-in members using weighted scoring. Preview before applying.
            </p>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
            {/* Preset */}
            <div className="space-y-1.5">
              <Label>Preset</Label>
              <Select value={autoPairPreset} onValueChange={(v) => {
                setAutoPairPreset(v);
                const presets: Record<string, AutoPairWeights> = {
                  balanced:  { requested_match: 1.0, major_similarity: 0.4, interest_overlap: 0.3, load_balance: 0.2 },
                  requested: { requested_match: 2.0, major_similarity: 0.2, interest_overlap: 0.1, load_balance: 0.1 },
                  major:     { requested_match: 0.5, major_similarity: 1.0, interest_overlap: 0.3, load_balance: 0.3 },
                };
                if (presets[v]) setAutoPairWeights(presets[v]);
              }}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="balanced">Balanced</SelectItem>
                  <SelectItem value="requested">Honor Requested Matches</SelectItem>
                  <SelectItem value="major">Spread by Major</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Weight sliders */}
            <div className="space-y-3">
              <Label>Weights</Label>
              {([
                { key: "requested_match" as keyof AutoPairWeights, label: "Requested match" },
                { key: "major_similarity" as keyof AutoPairWeights, label: "Major similarity" },
                { key: "interest_overlap" as keyof AutoPairWeights, label: "Interest overlap" },
                { key: "load_balance" as keyof AutoPairWeights, label: "Load balance" },
              ]).map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-sm w-40 shrink-0">{label}</span>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.1}
                    value={autoPairWeights[key]}
                    onChange={(e) => {
                      setAutoPairPreset("custom");
                      setAutoPairWeights(w => ({ ...w, [key]: parseFloat(e.target.value) }));
                    }}
                    className="flex-1 accent-foreground"
                  />
                  <span className="text-sm w-8 text-right tabular-nums">{autoPairWeights[key].toFixed(1)}</span>
                </div>
              ))}
            </div>

            {/* Per-run exclusion override (for members not already cycle-excluded) */}
            {activeMembers.filter(m => !exclusions.some(e => e.membership_id === m.id)).length > 0 && (
              <div className="space-y-1.5">
                <Label>Skip for this run only</Label>
                <p className="text-xs text-muted-foreground">Uncheck members to exclude them from just this run without changing cycle settings.</p>
                <div className="grid grid-cols-2 gap-2 mt-2 max-h-40 overflow-y-auto">
                  {activeMembers
                    .filter(m => !exclusions.some(e => e.membership_id === m.id))
                    .map(m => {
                      const skipped = excludedMemberIds.has(m.id);
                      return (
                        <label key={m.id} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors ${skipped ? "bg-muted/40 text-muted-foreground" : "hover:bg-muted/20"}`}>
                          <input
                            type="checkbox"
                            checked={!skipped}
                            onChange={(e) => {
                              setExcludedMemberIds(prev => {
                                const next = new Set(prev);
                                if (e.target.checked) next.delete(m.id);
                                else next.add(m.id);
                                return next;
                              });
                              setAutoPairPreview(null);
                            }}
                            className="rounded"
                          />
                          <span className="truncate text-xs">{m.user_name}</span>
                        </label>
                      );
                    })}
                </div>
              </div>
            )}

            {autoPairError && <p className="text-sm text-destructive">{autoPairError}</p>}
          </div>

          <DialogFooter className="px-5 py-3 border-t gap-2">
            <Button variant="outline" onClick={() => setAutoPairOpen(false)}>Cancel</Button>
            <Button
              disabled={previewAutoPair.isPending}
              onClick={() => {
                const payload = {
                  weights: autoPairWeights,
                  excluded_membership_ids: Array.from(excludedMemberIds),
                };
                setLastAutoPairPayload(payload);
                previewAutoPair.mutate(payload);
              }}
            >
              {previewAutoPair.isPending ? "Generating preview…" : "Preview in table"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Cycle Settings</DialogTitle></DialogHeader>
          <div className="space-y-5 py-2">
            {/* Basic settings */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Cycle name</Label>
                <Input value={settingsForm.name ?? ""} onChange={e => setSettingsForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Google Sheet ID <span className="text-xs text-muted-foreground font-normal">(applicants)</span></Label>
                <Input value={settingsForm.sheet_id ?? ""} onChange={e => setSettingsForm(f => ({ ...f, sheet_id: e.target.value }))} placeholder="URL or ID from the sheet" />
              </div>
              <div className="space-y-1.5">
                <Label>Evaluation Sheet ID <span className="text-xs text-muted-foreground font-normal">(member feedback)</span></Label>
                <Input value={settingsForm.evaluation_sheet_id ?? ""} onChange={e => setSettingsForm(f => ({ ...f, evaluation_sheet_id: e.target.value }))} placeholder="URL or ID from the eval sheet" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Sender title <span className="text-xs text-muted-foreground font-normal">(sender name comes from whoever is signed in)</span></Label>
                <Input value={settingsForm.sender_title ?? ""} onChange={e => setSettingsForm(f => ({ ...f, sender_title: e.target.value }))} placeholder="Director of Recruitment" />
              </div>
            </div>

            {/* Column mapping */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Sheet column names</p>
              <p className="text-xs text-muted-foreground">
                Enter the exact column header from your Google Form/Sheet. These are saved and used every time the sheet syncs.
              </p>
              {sheetCols?.columns && sheetCols.columns.length > 0 && (
                <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                  <span className="font-medium">Columns in your sheet: </span>
                  <span className="font-mono">{sheetCols.columns.join(", ")}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    ["name_col", "Full Name column"],
                    ["email_col", "Cornell Email column"],
                    ["grad_col", "Graduation Date column"],
                    ["major_col", "Major column"],
                    ["interest_col", "Fields of Interest column"],
                    ["request_col", "Requested Member column"],
                    ["timestamp_col", "Timestamp column (for dedup)"],
                  ] as [keyof ColMap, string][]
                ).map(([key, label]) => {
                  const val = colMapForm[key];
                  const found = sheetCols?.columns?.includes(val);
                  const checked = sheetCols?.columns !== undefined;
                  return (
                    <div key={key} className="space-y-1">
                      <Label className="text-xs flex items-center gap-1">
                        {label}
                        {checked && (
                          found
                            ? <span className="text-green-600 font-normal">✓</span>
                            : <span className="text-amber-600 font-normal">✗ not found</span>
                        )}
                      </Label>
                      <Input
                        value={val}
                        className={checked && !found ? "border-amber-400" : ""}
                        onChange={e => setSettingsForm(f => ({
                          ...f,
                          column_mapping: { ...colMapForm, [key]: e.target.value },
                        }))}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Email templates */}
            <div className="space-y-1.5">
              <Label>Pairing email subject</Label>
              <Input value={settingsForm.pairing_subject ?? ""} onChange={e => setSettingsForm(f => ({ ...f, pairing_subject: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Pairing email body <span className="text-xs text-muted-foreground">(HTML — use {"{{applicant_first}}"}, {"{{member_first}}"}, {"{{member_last}}"}, {"{{member_year}}"}, {"{{member_major}}"}, {"{{applicant_year}}"}, {"{{applicant_major}}"}, {"{{sender_name}}"}, {"{{sender_title}}"})</span></Label>
              <textarea rows={8} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={settingsForm.pairing_body ?? ""}
                onChange={e => setSettingsForm(f => ({ ...f, pairing_body: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Rejection email subject</Label>
              <Input value={settingsForm.rejection_subject ?? ""} onChange={e => setSettingsForm(f => ({ ...f, rejection_subject: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Rejection email body <span className="text-xs text-muted-foreground">(HTML — use {"{{applicant_first}}"}, {"{{sender_name}}"}, {"{{sender_title}}"})</span></Label>
              <textarea rows={6} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={settingsForm.rejection_body ?? ""}
                onChange={e => setSettingsForm(f => ({ ...f, rejection_body: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="flex-col items-end gap-2">
            {settingsError && <p className="text-xs text-destructive w-full">{settingsError}</p>}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setSettingsOpen(false); setSettingsError(null); }}>Cancel</Button>
              <Button onClick={() => updateCycle.mutate(settingsForm)} disabled={updateCycle.isPending}>
                {updateCycle.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
