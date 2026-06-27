"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Download, Send, X, Settings, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { createApi } from "@/lib/api";
import type { MembershipDetail } from "@cba/types";

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

type ColMap = { name_col: string; email_col: string; grad_col: string; major_col: string; request_col: string };

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

export default function CycleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const router = useRouter();
  const qc = useQueryClient();
  const api = createApi(session?.accessToken);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [colMap, setColMap] = useState<ColMap>({
    name_col: "Full Name", email_col: "Cornell Email Address",
    grad_col: "Graduation Date", major_col: "Intended Major(s)", request_col: "Paired Member",
  });
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [settingsForm, setSettingsForm] = useState<Partial<Cycle>>({});

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

  const { data: sheetCols } = useQuery<{ columns: string[] }>({
    queryKey: ["sheet-cols", id],
    queryFn: () => api.get<{ columns: string[] }>(`/ops/v1/recruitment/cycles/${id}/sheet-columns`),
    enabled: !!session?.accessToken && importOpen,
  });

  const importMutation = useMutation({
    mutationFn: () => api.post<{ imported: number; skipped: number }>(`/ops/v1/recruitment/cycles/${id}/import`, colMap),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["applicants", id] });
      setImportOpen(false);
      alert(`Imported ${data.imported} applicants, skipped ${data.skipped} duplicates.`);
    },
  });

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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["applicants", id] }); setSendingId(null); },
    onError: (err: Error) => { alert(`Failed to send: ${err.message}`); setSendingId(null); },
  });

  const markSent = useMutation({
    mutationFn: (applicantId: string) =>
      api.post<void>(`/ops/v1/recruitment/cycles/${id}/applicants/${applicantId}/mark-sent`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["applicants", id] }); setMarkingId(null); },
  });

  const sendRejection = useMutation({
    mutationFn: (applicantId: string) =>
      api.post<void>(`/ops/v1/recruitment/cycles/${id}/applicants/${applicantId}/send-rejection-email`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["applicants", id] }); setRejectingId(null); },
    onError: (err: Error) => { alert(`Failed to send rejection: ${err.message}`); setRejectingId(null); },
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
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cycle", id] });
      qc.invalidateQueries({ queryKey: ["coffee-chat-cycles"] });
      setSettingsOpen(false);
    },
  });

  const handleOpenSettings = () => {
    setSettingsForm(cycle ?? {});
    setSettingsOpen(true);
  };

  const unpairedCount = applicants.filter(a => a.pairing_status === "unpaired").length;
  const sentCount = applicants.filter(a => a.pairing_status === "sent").length;

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
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleOpenSettings}>
            <Settings className="h-4 w-4 mr-1" /> Settings
          </Button>
          {cycle?.sheet_id ? (
            <Button size="sm" onClick={() => setImportOpen(true)}>
              <Download className="h-4 w-4 mr-1" /> Import from Sheet
            </Button>
          ) : (
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
            No applicants yet. Import from Google Sheet to get started.
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
                          {members.map(m => (
                            <SelectItem key={m.id} value={m.id}>{m.user_name}</SelectItem>
                          ))}
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
                    <div className="flex items-center gap-1.5">
                      {a.pairing_status === "paired" && (
                        <>
                          <Button size="sm" className="h-7 text-xs" disabled={sendingId === a.id}
                            onClick={() => { setSendingId(a.id); sendPairing.mutate(a.id); }}>
                            <Send className="h-3 w-3 mr-1" />
                            {sendingId === a.id ? "Sending…" : "Send"}
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs"
                            disabled={markingId === a.id}
                            title="Mark as sent without emailing"
                            onClick={() => { if (!confirm(`Mark ${a.name} as sent without emailing?`)) return; setMarkingId(a.id); markSent.mutate(a.id); }}>
                            <Check className="h-3 w-3 mr-1" />
                            {markingId === a.id ? "Marking…" : "Mark sent"}
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs text-destructive hover:text-destructive"
                            disabled={rejectingId === a.id}
                            onClick={() => { if (!confirm(`Send rejection to ${a.name}?`)) return; setRejectingId(a.id); sendRejection.mutate(a.id); }}>
                            <X className="h-3 w-3 mr-1" /> Reject
                          </Button>
                        </>
                      )}
                      {a.pairing_status === "unpaired" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs text-destructive hover:text-destructive"
                          disabled={rejectingId === a.id}
                          onClick={() => { if (!confirm(`Send rejection to ${a.name}?`)) return; setRejectingId(a.id); sendRejection.mutate(a.id); }}>
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
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Settings dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Cycle Settings</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Cycle name</Label>
                <Input value={settingsForm.name ?? ""} onChange={e => setSettingsForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Google Sheet ID</Label>
                <Input value={settingsForm.sheet_id ?? ""} onChange={e => setSettingsForm(f => ({ ...f, sheet_id: e.target.value }))} placeholder="From the sheet URL" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Sender title <span className="text-xs text-muted-foreground font-normal">(shared — sender name comes from whoever is signed in)</span></Label>
                <Input value={settingsForm.sender_title ?? ""} onChange={e => setSettingsForm(f => ({ ...f, sender_title: e.target.value }))} placeholder="Director of Recruitment" />
              </div>
            </div>
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

      {/* Import dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Import from Google Sheet</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <p className="text-muted-foreground">Map your sheet&apos;s column headers to the fields below.</p>
            {sheetCols?.columns && (
              <p className="text-xs text-muted-foreground">
                Detected columns: <span className="font-mono">{sheetCols.columns.join(", ")}</span>
              </p>
            )}
            {(["name_col", "email_col", "grad_col", "major_col", "request_col"] as (keyof ColMap)[]).map(key => {
              const labels: Record<keyof ColMap, string> = {
                name_col: "Full Name column", email_col: "Cornell Email column",
                grad_col: "Graduation Date column", major_col: "Major column", request_col: "Requested Member column",
              };
              return (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{labels[key]}</Label>
                  <Input value={colMap[key]} onChange={e => setColMap(m => ({ ...m, [key]: e.target.value }))} />
                </div>
              );
            })}
            <p className="text-xs text-muted-foreground">Existing applicants (matched by netID + timestamp) will be skipped.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
            <Button onClick={() => importMutation.mutate()} disabled={importMutation.isPending}>
              {importMutation.isPending ? "Importing…" : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
