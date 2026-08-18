"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useAppSession } from "@/hooks/session-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Send, X, Settings, Check, RotateCcw, RefreshCw, Search, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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

interface Cycle {
  id: string;
  name: string;
  sheet_id: string | null;
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

  const activeMembers = members.filter(m => m.is_active);

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
          {/* Sync indicator */}
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

      {/* Applicant table */}
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
              {applicants.map((a) => (
                <tr key={a.id} className="hover:bg-muted/10">
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
                    {a.pairing_status === "sent" || a.pairing_status === "rejected" ? (
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
              ))}
            </tbody>
          </table>
        )}
      </div>

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
                <Label>Google Sheet ID</Label>
                <Input value={settingsForm.sheet_id ?? ""} onChange={e => setSettingsForm(f => ({ ...f, sheet_id: e.target.value }))} placeholder="URL or ID from the sheet" />
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
