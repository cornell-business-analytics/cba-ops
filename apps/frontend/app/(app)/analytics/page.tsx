"use client";

import { useAppSession } from "@/hooks/session-context";
import { useQuery } from "@tanstack/react-query";
import {
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import { Users, UserSearch, Coffee, Users2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { createApi } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import type { AnalyticsOverview, MembersAnalytics } from "@cba/types";

const PIE_COLORS = [
  "#1a7a3c", "#2a9e52", "#4DB8A0", "#818cf8", "#f59e0b",
  "#22d3ee", "#f43f5e", "#a78bfa", "#fb923c", "#34d399",
  "#60a5fa", "#e879f9", "#facc15", "#38bdf8", "#4ade80",
];

export default function AnalyticsPage() {
  const session = useAppSession();
  const api = () => createApi(session?.accessToken);

  const { data: overview } = useQuery<AnalyticsOverview>({
    queryKey: ["analytics", "overview"],
    queryFn: () => api().get("/ops/v1/analytics/overview"),
    enabled: !!session?.accessToken,
    staleTime: 2 * 60 * 1000,
  });

  const { data: members } = useQuery<MembersAnalytics>({
    queryKey: ["analytics", "members"],
    queryFn: () => api().get("/ops/v1/analytics/members"),
    enabled: !!session?.accessToken,
    staleTime: 5 * 60 * 1000,
  });

  const gradYearData = Object.entries(members?.grad_year_distribution ?? {})
    .map(([year, value]) => ({ name: year, value }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const majorData = Object.entries(members?.major_distribution ?? {})
    .map(([name, value]) => ({ name, value }));

  const stats = [
    { label: "Total Members", value: overview?.total_members, icon: Users },
    { label: "Active Candidates", value: overview?.active_candidates, icon: UserSearch },
    { label: "Coffee Chats", value: overview?.total_coffee_chats, icon: Coffee },
    { label: "Unique Candidates Chatted", value: overview?.unique_coffee_chats, icon: Users2 },
  ];

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Analytics" subtitle="Key metrics for the current semester" />

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

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Grad Year Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {gradYearData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={gradYearData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {gradYearData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [`${v} members`]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                No grad year data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Major Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {majorData.length > 0 ? (
              <ResponsiveContainer width="100%" height={480}>
                <PieChart>
                  <Pie
                    data={majorData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    outerRadius={150}
                    label={({ name, percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ""}
                    labelLine={false}
                  >
                    {majorData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, name) => [`${v} members`, name]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                No major data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
