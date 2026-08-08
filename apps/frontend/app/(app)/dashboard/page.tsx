"use client";

import { useAppSession } from "@/hooks/session-context";
import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import Link from "next/link";
import { createApi } from "@/lib/api";
import type { AnalyticsOverview, Event } from "@cba/types";

function getSemester(): string {
  const now = new Date();
  const year = now.getFullYear();
  return now.getMonth() >= 7 ? `Fall ${year}` : `Spring ${year}`;
}

export default function DashboardPage() {
  const session = useAppSession();
  const firstName = session?.user?.name?.split(" ")[0];

  const { data: overview, isLoading: statsLoading } = useQuery<AnalyticsOverview>({
    queryKey: ["analytics", "overview"],
    queryFn: () => createApi(session?.accessToken).get("/ops/v1/analytics/overview"),
    enabled: !!session?.accessToken,
  });

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ["events"],
    queryFn: () => createApi(session?.accessToken).get("/ops/v1/events"),
    enabled: !!session?.accessToken,
  });

  const now = new Date();
  const upcoming = events
    .filter((e: Event) => new Date(e.event_date) >= now)
    .sort((a: Event, b: Event) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
    .slice(0, 5);

  return (
    <div className="flex flex-col">
      <div className="border-b bg-muted/30 px-8 py-7">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
          {getSemester()}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {firstName ? `Welcome back, ${firstName}` : "Dashboard"}
        </h1>
      </div>

      <div className="flex">
        <div className="flex-1 border-r px-8 py-8">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-6">
            At a glance
          </p>

          <div className="mb-8">
            <div className="text-5xl font-bold tabular-nums tracking-tight leading-none">
              {statsLoading ? (
                <span className="text-muted-foreground/30">—</span>
              ) : (
                overview?.total_members ?? 0
              )}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">active members this semester</p>
          </div>

          <div className="grid grid-cols-2 gap-6 border-t pt-6">
            {[
              { key: "active_candidates" as const, label: "In recruitment pipeline" },
              { key: "events_this_semester" as const, label: "Events this semester" },
            ].map(({ key, label }) => (
              <div key={key}>
                <div className="text-2xl font-semibold tabular-nums">
                  {statsLoading ? "—" : (overview?.[key] ?? 0)}
                </div>
                <p className="mt-1 text-xs leading-snug text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="w-80 shrink-0 px-6 py-8">
          <div className="mb-5 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Upcoming events
            </p>
            <Link
              href="/events"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              All events →
            </Link>
          </div>

          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No upcoming events.{" "}
              <Link href="/events" className="underline underline-offset-2">
                Add one →
              </Link>
            </p>
          ) : (
            <ul className="space-y-5">
              {upcoming.map((event: Event) => {
                const d = new Date(event.event_date);
                return (
                  <li key={event.id} className="flex items-start gap-4">
                    <div className="w-10 shrink-0 text-center">
                      <p className="text-[10px] font-semibold uppercase leading-none tracking-wider text-muted-foreground">
                        {d.toLocaleDateString("en-US", { month: "short" })}
                      </p>
                      <p className="mt-0.5 text-xl font-bold leading-tight">{d.getDate()}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{event.title}</p>
                      {event.location && (
                        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {event.location}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
