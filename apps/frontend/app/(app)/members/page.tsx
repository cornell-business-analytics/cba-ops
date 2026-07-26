"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Image from "next/image";
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
import type { MembershipDetail, Cohort } from "@cba/types";

interface MemberCreate {
  email: string;
  name: string;
  cohortId: string;
  roleTitle: string;
  gradYear: string;
  major: string;
}

const AVATAR_PALETTE = [
  "bg-red-500", "bg-orange-500", "bg-amber-500", "bg-yellow-500",
  "bg-lime-600", "bg-green-600", "bg-teal-600", "bg-cyan-600",
  "bg-sky-500", "bg-emerald-600", "bg-indigo-600", "bg-violet-600",
  "bg-purple-600", "bg-fuchsia-600", "bg-pink-600", "bg-rose-600",
];

function avatarColor(name: string): string {
  return AVATAR_PALETTE[(name.charCodeAt(0) ?? 0) % AVATAR_PALETTE.length];
}

export default function MembersPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [cohortFilter, setCohortFilter] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [cohortOpen, setCohortOpen] = useState(false);
  const [newSemester, setNewSemester] = useState({ term: "Fall", year: new Date().getFullYear().toString() });
  const [form, setForm] = useState<MemberCreate>({
    email: "",
    name: "",
    cohortId: "",
    roleTitle: "Analyst",
    gradYear: "",
    major: "",
  });

  const api = createApi(session?.accessToken);
  const canAdd = session?.role === "director" || session?.role === "eboard";

  const { data: members = [], isLoading } = useQuery<MembershipDetail[]>({
    queryKey: ["members"],
    queryFn: () => api.get("/ops/v1/members"),
    enabled: !!session?.accessToken,
  });

  const { data: cohorts = [] } = useQuery<Cohort[]>({
    queryKey: ["cohorts"],
    queryFn: () => api.get("/ops/v1/cohorts"),
    enabled: !!session?.accessToken,
  });

  const createCohort = useMutation({
    mutationFn: () => api.post<Cohort>("/ops/v1/cohorts", { semester: `${newSemester.term} ${newSemester.year}` }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cohorts"] });
      setCohortOpen(false);
      setNewSemester({ term: "Fall", year: new Date().getFullYear().toString() });
    },
  });

  function parseSemesterOrder(semester: string): number {
    const [term, year] = semester.split(" ");
    return parseInt(year) * 10 + (term === "Fall" ? 1 : 0);
  }

  const sortedCohorts = [...cohorts].sort((a, b) => parseSemesterOrder(b.semester) - parseSemesterOrder(a.semester));

  const addMutation = useMutation({
    mutationFn: () =>
      api.post<MembershipDetail>("/ops/v1/members/invite", {
        email: form.email.trim().toLowerCase(),
        name: form.name.trim(),
        cohort_id: form.cohortId,
        role_title: form.roleTitle,
        grad_year: form.gradYear || null,
        major: form.major || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      setAddOpen(false);
      setForm({ email: "", name: "", cohortId: "", roleTitle: "Analyst", gradYear: "", major: "" });
    },
  });

  const filtered = members.filter((m) => {
    const matchSearch =
      !search ||
      m.user_name.toLowerCase().includes(search.toLowerCase()) ||
      m.role_title.toLowerCase().includes(search.toLowerCase()) ||
      (m.major ?? "").toLowerCase().includes(search.toLowerCase());
    const matchCohort = cohortFilter === "all" || m.cohort_id === cohortFilter;
    return matchSearch && matchCohort;
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Members</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} active</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Cohort filter */}
          <div className="flex items-center gap-1">
            <Select value={cohortFilter} onValueChange={setCohortFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All cohorts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All cohorts</SelectItem>
                {sortedCohorts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.semester}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {session?.role === "eboard" && (
              <Button size="sm" variant="outline" className="px-2" onClick={() => setCohortOpen(true)} title="New cohort">
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Search */}
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search name, role, major…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {canAdd && (
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Member
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-white overflow-hidden">
        {isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                {["Name", "Role", "Major", "Grad Year", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((m) => {
                const initials = m.user_name?.charAt(0).toUpperCase() ?? "?";
                return (
                  <tr
                    key={m.id}
                    className="hover:bg-muted/20 cursor-pointer transition-colors"
                    onClick={() => router.push(`/members/${m.id}`)}
                  >
                    {/* Name + avatar */}
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        {m.headshot_url ? (
                          <Image
                            src={m.headshot_url}
                            alt={m.user_name}
                            width={28}
                            height={28}
                            className="rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <span
                            className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-xs font-semibold shrink-0 ${avatarColor(m.user_name ?? "")}`}
                          >
                            {initials}
                          </span>
                        )}
                        <span className="font-medium">{m.user_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">{m.role_title}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{m.major ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{m.grad_year ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={m.is_active ? "success" : "outline"}>
                        {m.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Link href={`/members/${m.id}`}>View profile</Link>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Create cohort dialog */}
      <Dialog open={cohortOpen} onOpenChange={setCohortOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Cohort</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2 py-2">
            <div className="space-y-1.5 flex-1">
              <Label>Term</Label>
              <Select value={newSemester.term} onValueChange={(v) => setNewSemester(s => ({ ...s, term: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Fall">Fall</SelectItem>
                  <SelectItem value="Spring">Spring</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 flex-1">
              <Label>Year</Label>
              <Input
                value={newSemester.year}
                onChange={(e) => setNewSemester(s => ({ ...s, year: e.target.value }))}
                placeholder="2025"
                maxLength={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCohortOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createCohort.mutate()}
              disabled={!newSemester.year.trim() || createCohort.isPending}
            >
              {createCohort.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Cornell Email</Label>
              <Input
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="netid@cornell.edu"
                type="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Name <span className="text-muted-foreground text-xs">(optional — updated when they log in)</span></Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="First Last"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cohort</Label>
              <Select value={form.cohortId} onValueChange={(v) => setForm((f) => ({ ...f, cohortId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select cohort…" />
                </SelectTrigger>
                <SelectContent>
                  {sortedCohorts.map((c) => (
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
              disabled={!form.email.trim() || !form.cohortId || addMutation.isPending}
            >
              {addMutation.isPending ? "Adding…" : "Add Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
