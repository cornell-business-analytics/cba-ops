"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Users, UserSearch, Globe, CalendarDays } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { createApi } from "@/lib/api";
import type { AnalyticsOverview } from "@cba/types";

const statCards = [
  { key: "total_members", label: "Total Members", icon: Users, color: "text-blue-600" },
  { key: "active_candidates", label: "Active Candidates", icon: UserSearch, color: "text-purple-600" },
  { key: "published_pages", label: "Published Pages", icon: Globe, color: "text-green-600" },
  { key: "events_this_semester", label: "Events This Semester", icon: CalendarDays, color: "text-orange-600" },
] as const;

export default function DashboardPage() {
  const { data: session } = useSession();

  const { data: overview, isLoading } = useQuery<AnalyticsOverview>({
    queryKey: ["analytics", "overview"],
    queryFn: () => createApi(session?.accessToken).get("/ops/v1/analytics/overview"),
    enabled: !!session?.accessToken,
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of CBA operations</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map(({ key, label, icon: Icon, color }) => (
          <Card key={key}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{label}</CardTitle>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {isLoading ? "—" : (overview?.[key] ?? 0)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="rounded-lg border bg-white p-5">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Quick links</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { href: "/recruitment", label: "Recruitment pipeline" },
            { href: "/members", label: "Member directory" },
            { href: "/website", label: "Manage website" },
            { href: "/events", label: "Events" },
          ].map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="rounded-md border px-3 py-2 text-sm text-center hover:bg-muted transition-colors"
            >
              {label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
