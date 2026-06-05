"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createApi, ApiError } from "@/lib/api";
import type { AllowedEmail, User, UserRole } from "@cba/types";

const ROLES: UserRole[] = ["member", "pm", "director", "eboard"];

export default function AccessPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const [addEmailOpen, setAddEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [savingRoles, setSavingRoles] = useState<Record<string, boolean>>({});
  const [pendingRoles, setPendingRoles] = useState<Record<string, UserRole>>({});

  if (session?.role !== "eboard") {
    redirect("/dashboard");
  }

  const api = createApi(session?.accessToken);

  const { data: allowedEmails = [], isLoading: loadingEmails } = useQuery<AllowedEmail[]>({
    queryKey: ["allowed-emails"],
    queryFn: () => api.get("/ops/v1/access/allowed-emails"),
    enabled: !!session?.accessToken,
  });

  const { data: users = [], isLoading: loadingUsers } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: () => api.get("/ops/v1/users"),
    enabled: !!session?.accessToken,
  });

  const addEmailMutation = useMutation({
    mutationFn: (email: string) =>
      api.post<AllowedEmail>("/ops/v1/access/allowed-emails", { email }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allowed-emails"] });
      setAddEmailOpen(false);
      setNewEmail("");
      setEmailError("");
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        setEmailError("This email is already in the allowlist.");
      } else {
        setEmailError("Something went wrong. Please try again.");
      }
    },
  });

  const deleteEmailMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/ops/v1/access/allowed-emails/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["allowed-emails"] }),
  });

  async function handleRoleSave(userId: string) {
    const role = pendingRoles[userId];
    if (!role) return;
    setSavingRoles((prev) => ({ ...prev, [userId]: true }));
    try {
      await api.patch(`/ops/v1/users/${userId}/role`, { role });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setPendingRoles((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    } finally {
      setSavingRoles((prev) => ({ ...prev, [userId]: false }));
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Access Management</h1>
        <p className="text-sm text-muted-foreground">Control who can sign in and manage user roles</p>
      </div>

      <Tabs defaultValue="emails">
        <TabsList>
          <TabsTrigger value="emails">Allowed Emails</TabsTrigger>
          <TabsTrigger value="roles">User Roles</TabsTrigger>
        </TabsList>

        <TabsContent value="emails" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setAddEmailOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Email
            </Button>
          </div>

          <div className="rounded-lg border bg-white overflow-hidden">
            {loadingEmails ? (
              <p className="p-4 text-sm text-muted-foreground">Loading…</p>
            ) : allowedEmails.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No emails in the allowlist.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {["Email", "Added", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {allowedEmails.map((e) => (
                    <tr key={e.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{e.email}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(e.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteEmailMutation.mutate(e.id)}
                          disabled={deleteEmailMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="roles" className="space-y-4 mt-4">
          <div className="rounded-lg border bg-white overflow-hidden">
            {loadingUsers ? (
              <p className="p-4 text-sm text-muted-foreground">Loading…</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {["Name", "Email", "Role", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map((u) => {
                    const currentRole = pendingRoles[u.id] ?? u.role;
                    const isDirty = pendingRoles[u.id] !== undefined;
                    return (
                      <tr key={u.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">{u.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                        <td className="px-4 py-3">
                          <Select
                            value={currentRole}
                            onValueChange={(val) =>
                              setPendingRoles((prev) => ({ ...prev, [u.id]: val as UserRole }))
                            }
                          >
                            <SelectTrigger className="w-32 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLES.map((r) => (
                                <SelectItem key={r} value={r}>{r}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            disabled={!isDirty || savingRoles[u.id]}
                            onClick={() => handleRoleSave(u.id)}
                          >
                            {savingRoles[u.id] ? "Saving…" : "Save"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={addEmailOpen} onOpenChange={setAddEmailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Allowed Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Input
              placeholder="name@cornell.edu"
              value={newEmail}
              onChange={(e) => {
                setNewEmail(e.target.value);
                setEmailError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") addEmailMutation.mutate(newEmail);
              }}
            />
            {emailError && <p className="text-sm text-destructive">{emailError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddEmailOpen(false)}>Cancel</Button>
            <Button
              onClick={() => addEmailMutation.mutate(newEmail)}
              disabled={!newEmail.trim() || addEmailMutation.isPending}
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
