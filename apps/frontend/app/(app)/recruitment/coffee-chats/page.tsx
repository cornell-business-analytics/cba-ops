"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Plus, Coffee, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { createApi } from "@/lib/api";

interface Cycle {
  id: string;
  name: string;
  sheetId: string | null;
  senderName: string;
  senderTitle: string;
  isActive: boolean;
  applicantCount: number;
}

interface GmailStatus {
  connected: boolean;
  accountEmail: string | null;
}

export default function CoffeeChatsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const qc = useQueryClient();
  const api = createApi(session?.accessToken);

  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState({ name: "", sheetId: "", senderTitle: "Director of Recruitment" });

  const { data: cycles = [], isLoading } = useQuery<Cycle[]>({
    queryKey: ["coffee-chat-cycles"],
    queryFn: () => api.get("/ops/v1/recruitment/cycles"),
    enabled: !!session?.accessToken,
  });

  const { data: gmailStatus } = useQuery<GmailStatus>({
    queryKey: ["gmail-status"],
    queryFn: () => api.get("/ops/v1/recruitment/gmail-status"),
    enabled: !!session?.accessToken,
  });

  const { data: authUrlData } = useQuery<{ url: string }>({
    queryKey: ["gmail-auth-url"],
    queryFn: () => api.get("/ops/v1/recruitment/gmail-auth-url"),
    enabled: !!session?.accessToken && session?.role === "eboard",
  });

  const createCycle = useMutation({
    mutationFn: () => api.post<Cycle>("/ops/v1/recruitment/cycles", {
      name: form.name,
      sheet_id: form.sheetId || null,
      sender_title: form.senderTitle,
    }),
    onSuccess: (data: Cycle) => {
      qc.invalidateQueries({ queryKey: ["coffee-chat-cycles"] });
      setNewOpen(false);
      setForm({ name: "", sheetId: "", senderTitle: "Director of Recruitment" });
      router.push(`/recruitment/coffee-chats/${data.id}`);
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Coffee className="h-5 w-5" /> Coffee Chats
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Import applicants, assign pairings, send emails via Gmail.</p>
        </div>
        <Button size="sm" onClick={() => setNewOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Cycle
        </Button>
      </div>

      {/* Gmail status banner */}
      <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${gmailStatus?.connected ? "border-green-200 bg-green-50 text-green-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
        {gmailStatus?.connected ? (
          <>
            <Wifi className="h-4 w-4 shrink-0" />
            <span>Gmail connected as <strong>{gmailStatus.accountEmail}</strong></span>
            {session?.role === "eboard" && authUrlData?.url && (
              <a href={authUrlData.url} className="ml-auto text-xs underline">Reconnect</a>
            )}
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4 shrink-0" />
            <span>Gmail not connected — emails cannot be sent.</span>
            {session?.role === "eboard" && authUrlData?.url && (
              <a href={authUrlData.url} className="ml-auto underline font-medium">Connect Gmail →</a>
            )}
            {session?.role !== "eboard" && (
              <span className="ml-auto text-xs">Ask eboard to connect Gmail.</span>
            )}
          </>
        )}
      </div>

      {/* Cycles list */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : cycles.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Coffee className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No cycles yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {cycles.map((c) => (
            <button
              key={c.id}
              onClick={() => router.push(`/recruitment/coffee-chats/${c.id}`)}
              className="w-full flex items-center justify-between rounded-lg border bg-white px-5 py-4 text-left hover:bg-muted/30 transition-colors"
            >
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {c.applicantCount} applicant{c.applicantCount !== 1 ? "s" : ""}
                  {c.senderName && ` · ${c.senderName}`}
                </p>
              </div>
              <Badge variant={c.isActive ? "success" : "outline"}>
                {c.isActive ? "Active" : "Closed"}
              </Badge>
            </button>
          ))}
        </div>
      )}

      {/* New cycle dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Coffee Chat Cycle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Cycle name</Label>
              <Input placeholder="e.g. Fall 2025" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Google Sheet ID <span className="text-muted-foreground text-xs">(optional — can add later)</span></Label>
              <Input placeholder="Paste the sheet ID from the URL" value={form.sheetId} onChange={(e) => setForm(f => ({ ...f, sheetId: e.target.value }))} />
              <p className="text-xs text-muted-foreground">The long string between /d/ and /edit in the Google Sheet URL.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Sender title <span className="text-muted-foreground text-xs">(shared — name comes from whoever is signed in)</span></Label>
              <Input placeholder="Director of Recruitment" value={form.senderTitle} onChange={(e) => setForm(f => ({ ...f, senderTitle: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button onClick={() => createCycle.mutate()} disabled={!form.name || createCycle.isPending}>
              {createCycle.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
