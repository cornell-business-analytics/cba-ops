"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Plus } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { createApi } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import type { Membership, User, Cohort } from "@cba/types";

interface MemberCreate {
  userId: string;
  cohortId: string;
  roleTitle: string;
  gradYear: string;
  major: string;
}

export default function MembersPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<MemberCreate>({
    userId: "",
    cohortId: "",
    roleTitle: "Analyst",
    gradYear: "",
    major: "",
  });

  const api = createApi(session?.accessToken);
  const canAdd = session?.role === "director" || session?.role === "eboard";

  const { data: members = [], isLoading } = useQuery<Membership[]>({
    queryKey: ["members"],
    queryFn: () => api.get("/ops/v1/members"),
    enabled: !!session?.accessToken,
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: () => api.get("/ops/v1/users"),
    enabled: !!session?.accessToken && addOpen,
  });

  const { data: cohorts = [] } = useQuery<Cohort[]>({
    queryKey: ["cohorts"],
    queryFn: () => api.get("/ops/v1/cohorts"),
    enabled: !!session?.accessToken && addOpen,
  });

  const addMutation = useMutation({
    mutationFn: () =>
      api.post<Membership>("/ops/v1/members", {
        user_id: form.userId,
        cohort_id: form.cohortId,
        role_title: form.roleTitle,
        grad_year: form.gradYear || null,
        major: form.major || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      setAddOpen(false);
      setForm({ userId: "", cohortId: "", roleTitle: "Analyst", gradYear: "", major: "" });
    },
  });

  const filtered = members.filter(
    (m) =>
      !search ||
      m.role_title.toLowerCase().includes(search.toLowerCase()) ||
      (m.major ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Members"
        subtitle={`${filtered.length} active`}
        action={
          <div className="flex items-center gap-3">
            {canAdd && (
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add Member
              </Button>
            )}
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search role, major…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        }
      />

      <div className="rounded-lg border bg-white overflow-hidden">
        {isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {["Role", "Major", "Grad Year", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((m) => (
                <tr key={m.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{m.role_title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.major ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.grad_year ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={m.is_active ? "success" : "outline"}>
                      {m.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/members/${m.id}`}
                      className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>User</Label>
              <Select value={form.userId} onValueChange={(v) => setForm((f) => ({ ...f, userId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select user…" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name} — {u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cohort</Label>
              <Select value={form.cohortId} onValueChange={(v) => setForm((f) => ({ ...f, cohortId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select cohort…" />
                </SelectTrigger>
                <SelectContent>
                  {cohorts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.semester}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Role Title</Label>
              <Input
                value={form.roleTitle}
                onChange={(e) => setForm((f) => ({ ...f, roleTitle: e.target.value }))}
                placeholder="Analyst"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Grad Year</Label>
                <Input
                  value={form.gradYear}
                  onChange={(e) => setForm((f) => ({ ...f, gradYear: e.target.value }))}
                  placeholder="2026"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Major</Label>
                <Input
                  value={form.major}
                  onChange={(e) => setForm((f) => ({ ...f, major: e.target.value }))}
                  placeholder="Economics"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              onClick={() => addMutation.mutate()}
              disabled={!form.userId || !form.cohortId || addMutation.isPending}
            >
              {addMutation.isPending ? "Adding…" : "Add Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
