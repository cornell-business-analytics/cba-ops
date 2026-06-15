"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";
import { Users, UserSearch, Globe, CalendarDays, TrendingUp, Percent } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { createApi } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import type { AnalyticsOverview, RecruitmentAnalytics, MembersAnalytics } from "@cba/types";

const FUNNEL_ORDER = ["applied", "coffee_chat", "interviewing", "offer", "accepted"];
const FUNNEL_COLORS = ["#94a3b8", "#818cf8", "#f59e0b", "#22d3ee", "#22c55e"];
const ROLE_COLORS: Record<string, string> = {
  member: "#94a3b8",
  pm: "#818cf8",
  director: "#f59e0b",
  eboard: "#1a7a3c",
};

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

  const { data: members } = useQuery<MembersAnalytics>({
    queryKey: ["analytics", "members"],
    queryFn: () => api().get("/ops/v1/analytics/members"),
    enabled: !!session?.accessToken,
  });

  const funnelData = FUNNEL_ORDER.map((stage, i) => ({
    name: stage.replace("_", " "),
    count: recruitment?.funnel?.[stage] ?? 0,
    color: FUNNEL_COLORS[i],
  }));

  const cohortData = members?.cohort_growth ?? [];

  const roleData = Object.entries(members?.role_distribution ?? {}).map(([role, count]) => ({
    name: role,
    count,
    color: ROLE_COLORS[role] ?? "#94a3b8",
  }));

  const stats = [
    { label: "Total Members", value: overview?.total_members, icon: Users },
    { label: "Active Candidates", value: overview?.active_candidates, icon: UserSearch },
    { label: "Published Pages", value: overview?.published_pages, icon: Globe },
    { label: "Events This Semester", value: overview?.events_this_semester, icon: CalendarDays },
  ];

  const recruitmentStats = [
    { label: "Total Applicants", value: recruitment?.total_applicants, icon: TrendingUp },
    { label: "Offers Extended", value: recruitment?.offers, icon: UserSearch },
    {
      label: "Acceptance Rate",
      value:
        recruitment?.acceptance_rate != null
          ? `${(recruitment.acceptance_rate * 100).toFixed(0)}%`
          : undefined,
      icon: Percent,
    },
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recruitment Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
              {recruitmentStats.map(({ label, value, icon: Icon }) => (
                <div key={label} className="text-center">
                  <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                    <Icon className="h-3 w-3" />
                    {label}
                  </div>
                  <p className="text-lg font-semibold">{value ?? "—"}</p>
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={funnelData} margin={{ left: -10 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
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

        <Card>
          <CardHeader>
            <CardTitle>Cohort Growth</CardTitle>
          </CardHeader>
          <CardContent>
            {cohortData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={cohortData} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="semester" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#1a7a3c"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "#1a7a3c" }}
                    name="Members"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                No cohort data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Role Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          {roleData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={roleData} margin={{ left: -10 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Members">
                  {roleData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              No role data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
