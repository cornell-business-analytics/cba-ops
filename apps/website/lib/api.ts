import type { MemberPublic, EventPublic, PagePublic, RecruitmentStep } from "@cba/types";
import { PLACEHOLDER_EXEC, PLACEHOLDER_ANALYSTS, PLACEHOLDER_EVENTS } from "./placeholder-data";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:8000";

async function apiFetch<T>(path: string, tag: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      next: { tags: [tag], revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

export interface MemberGroups {
  eboard: MemberPublic[];
  directors: MemberPublic[];
  pms: MemberPublic[];
  analysts: MemberPublic[];
  abroad: MemberPublic[];
}

export async function getMembers(): Promise<MemberGroups> {
  const data = await apiFetch<MemberPublic[]>("/web/v1/members", "members");
  if (!data) {
    return {
      eboard: PLACEHOLDER_EXEC,
      directors: PLACEHOLDER_ANALYSTS.filter((m) => m.role === "director"),
      pms: PLACEHOLDER_ANALYSTS.filter((m) => m.role === "pm"),
      analysts: PLACEHOLDER_ANALYSTS.filter((m) => m.role === "member"),
      abroad: [],
    };
  }
  return {
    eboard: data.filter((m) => m.role === "eboard"),
    directors: data.filter((m) => m.role === "director"),
    pms: data.filter((m) => m.role === "pm"),
    analysts: data.filter((m) => m.role === "member" || m.role === "analyst"),
    abroad: data.filter((m) => m.role === "abroad"),
  };
}

export async function getEvents(type?: string): Promise<EventPublic[]> {
  const path = type ? `/web/v1/events?type=${type}` : "/web/v1/events";
  const data = await apiFetch<EventPublic[]>(path, "events");
  return data ?? PLACEHOLDER_EVENTS;
}

export async function getMember(id: string): Promise<MemberPublic | null> {
  return apiFetch<MemberPublic>(`/web/v1/members/${id}`, `member-${id}`);
}

export async function getPage(slug: string): Promise<PagePublic | null> {
  return apiFetch<PagePublic>(`/web/v1/pages/${slug}`, `page-${slug}`);
}

export async function getRecruitmentSteps(): Promise<RecruitmentStep[]> {
  const data = await apiFetch<RecruitmentStep[]>("/web/v1/recruitment-steps", "recruitment-steps");
  return data ?? [];
}

export async function getRecruitmentNoEventsMessage(): Promise<string> {
  const data = await apiFetch<{ message: string }>("/web/v1/recruitment-no-events-message", "recruitment-no-events-message");
  return data?.message ?? "";
}
