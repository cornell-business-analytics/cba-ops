"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { createApi } from "@/lib/api";
import type { Membership } from "@cba/types";

export default function MembersPage() {
  const { data: session } = useSession();
  const [search, setSearch] = useState("");

  const { data: members = [], isLoading } = useQuery<Membership[]>({
    queryKey: ["members"],
    queryFn: () => createApi(session?.accessToken).get("/ops/v1/members"),
    enabled: !!session?.accessToken,
  });

  const filtered = members.filter(
    (m) =>
      !search ||
      m.role_title.toLowerCase().includes(search.toLowerCase()) ||
      (m.major ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Members</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} active</p>
        </div>
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
    </div>
  );
}
