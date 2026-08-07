"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Send, X, Settings, Check, RotateCcw, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { createApi } from "@/lib/api";
import type { MembershipDetail } from "@cba/types";

interface ColMap {
  name_col: string;
  email_col: string;
  grad_col: string;
  major_col: string;
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
  request_col: "Paired Member",
  timestamp_col: "Timestamp",
};

export default function CycleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const router = useRouter();
  const qc = useQueryClient();
  const api = createApi(session?.accessToken);

  const canManageRecruitment = session?.role === "recruitment" || session?.role === "eboard";

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState<Partial<Cycle & { column_mapping: ColMap }>>({});
  const [confirmDialog, setConfirmDialog] = useState<{
    applicantId: string; applicantName: string; action: "send" | "reject" | "reset";
  } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Sync state shown in header
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const autoImportedRef = useRef(false);

  const { data: cycle } = useQuery<Cycle>({
    queryKey: ["cycle", id],
    queryFn: () => api.get<Cycle[]>(`/ops/v1/recruitment/cycles`).then((cs) => cs.find(c => c.id === id)!),
    enabled: !!session?.accessToken,
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

  // Auto-import once when cycle loads and has a sheet_id
  useEffect(() => {
    if (!cycle || !cycle.sheet_id || autoImportedRef.current || !session?.accessToken) return;
    autoImportedRef.current = true;
    setSyncStatus("syncing");
    setSyncMsg(null);
    importMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycle?.id, cycle?.sheet_id, session?.accessToken]);

  const pairMutation = useMutation({
    mutationFn: ({ applicantId, membershipId }: { applicantId: string; membershipId: string | null }) =>
      membershipId
        ? api.patch<unknown>(`/ops/v1/recruitment/cycles/${id}/applicants/${applicantId}/pairing`, { membership_id: membershipId })
        : api.delete<unknown>(`/ops/v1/recruitment/cycles/${id}/applicants/${applicantId}/pairing`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["applicants", id] }),
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["applicants", id] }); },
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
      setSettingsOpen(false);
    },
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
  };

  const handleManualSync = () => {
    setSyncStatus("syncing");
    setSyncMsg(null);
    importMutation.mutate();
  };

  const isPending = sendPairing.isPending || sendRejection.isPending || resetStatus.isPending;

  const unpairedCount = applicants.filter(a => a.pairing_status === "unpaired").length;
  const sentCount = applicants.filter(a => a.pairing_status === "sent").length;

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
                {["Applicant", "Major / Grad", "Requested", "Paired Member", "Status", "Actions"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {applicants.map((a) => (
                <tr key={a.id} className="hover:bg-muted/10">
                  <td className="px-4 py-3">
                    <p className="font-medium">{a.name}</p>
                    <p className="text-xs text-muted-foreground">{a.netid}@cornell.edu</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    <p>{a.major ?? "—"}</p>
                    <p>{a.grad_date ?? ""}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {a.requested_member_raw || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {a.pairing_status === "sent" || a.pairing_status === "rejected" ? (
                      <span className="text-sm text-muted-foreground">{a.paired_member_name ?? "—"}</span>
                    ) : (
                      <Select
                        value={a.paired_membership_id ?? "none"}
                        onValueChange={(v) => pairMutation.mutate({ applicantId: a.id, membershipId: v === "none" ? null : v })}
                      >
                        <SelectTrigger className="h-8 w-44 text-xs">
                          <SelectValue placeholder="Assign member…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— Unassigned —</SelectItem>
                          {activeMembers
                            .slice()
                            .sort((a, b) => (memberEmailCounts[a.id] ?? 0) - (memberEmailCounts[b.id] ?? 0))
                            .map(m => {
                              const count = memberEmailCounts[m.id] ?? 0;
                              return (
                                <SelectItem key={m.id} value={m.id}>
                                  {m.user_name}{count > 0 ? ` (${count})` : ""}
                                </SelectItem>
                              );
                            })}
                        </SelectContent>
                      </Select>
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
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {confirmDialog?.action === "send" && `Send pairing email to ${confirmDialog.applicantName}? This will CC the paired member.`}
            {confirmDialog?.action === "reject" && `Send a rejection email to ${confirmDialog?.applicantName}?`}
            {confirmDialog?.action === "reset" && `Reset status for ${confirmDialog?.applicantName}? This allows re-sending an email.`}
          </p>
          {actionError && <p className="text-sm text-destructive">{actionError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmDialog(null); setActionError(null); }}>Cancel</Button>
            <Button
              variant={confirmDialog?.action === "reject" ? "destructive" : "default"}
              onClick={handleConfirm}
              disabled={isPending}
            >
              {isPending ? "Sending…" : confirmDialog?.action === "send" ? "Send email" : confirmDialog?.action === "reject" ? "Send rejection" : "Reset"}
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
              <p className="text-xs text-muted-foreground">Enter the exact column header from your Google Form/Sheet. These are saved and used every time the sheet syncs.</p>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    ["name_col", "Full Name column"],
                    ["email_col", "Cornell Email column"],
                    ["grad_col", "Graduation Date column"],
                    ["major_col", "Major column"],
                    ["request_col", "Requested Member column"],
                    ["timestamp_col", "Timestamp column (for dedup)"],
                  ] as [keyof ColMap, string][]
                ).map(([key, label]) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs">{label}</Label>
                    <Input
                      value={colMapForm[key]}
                      onChange={e => setSettingsForm(f => ({
                        ...f,
                        column_mapping: { ...colMapForm, [key]: e.target.value },
                      }))}
                    />
                  </div>
                ))}
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>Cancel</Button>
            <Button onClick={() => updateCycle.mutate(settingsForm)} disabled={updateCycle.isPending}>
              {updateCycle.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
