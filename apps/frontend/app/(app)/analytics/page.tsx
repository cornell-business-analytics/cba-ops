"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Users, UserSearch, Globe, CalendarDays } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { createApi } from "@/lib/api";
import type { AnalyticsOverview, RecruitmentAnalytics } from "@cba/types";

const FUNNEL_ORDER = ["applied", "coffee_chat", "interviewing", "offer", "accepted"];
const FUNNEL_COLORS = ["#94a3b8", "#818cf8", "#f59e0b", "#22d3ee", "#22c55e"];

export default function AnalyticsPage() {
  const { data: session } = useSession();
  const api = () => createApi(session?.accessToken);

  const { data: overview } = useQuery<AnalyticsOverview>({
    queryKey: ["analytics", "overview"],
    queryFn: () => api().get("/ops/v1/analytics/overview"),
    enabled: !!session?.accessToken,
  });

  const { data: recruitment } = useQuery<RecruitmentAnalytics>({
    queryKey: ["analytics", "recruitment"],
    queryFn: () => api().get("/ops/v1/analytics/recruitment"),
    enabled: !!session?.accessToken,
  });

  const funnelData = FUNNEL_ORDER.map((stage, i) => ({
    name: stage.replace("_", " "),
    count: recruitment?.funnel?.[stage] ?? 0,
    color: FUNNEL_COLORS[i],
  }));

  const stats = [
    { label: "Total Members", value: overview?.total_members, icon: Users },
    { label: "Active Candidates", value: overview?.active_candidates, icon: UserSearch },
    { label: "Published Pages", value: overview?.published_pages, icon: Globe },
    { label: "Events This Semester", value: overview?.events_this_semester, icon: CalendarDays },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Analytics</h1>
        <p className="text-sm text-muted-foreground">Key metrics for the current semester</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{value ?? "—"}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recruitment Funnel</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={funnelData} margin={{ left: -10 }}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {funnelData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
