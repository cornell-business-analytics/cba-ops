import type { MemberPublic, EventPublic, PagePublic, RecruitmentStep } from "@cba/types";
import { PLACEHOLDER_EXEC, PLACEHOLDER_ANALYSTS, PLACEHOLDER_EVENTS } from "./placeholder-data";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:8000";

async function apiFetch<T>(path: string, tag: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      next: { tags: [tag] },
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

export async function getMembers(): Promise<{ exec: MemberPublic[]; analysts: MemberPublic[] }> {
  const data = await apiFetch<MemberPublic[]>("/web/v1/members?active=true", "members");
  if (!data) {
    return { exec: PLACEHOLDER_EXEC, analysts: PLACEHOLDER_ANALYSTS };
  }
  const exec = data.filter((m) =>
    ["President", "Vice President"].some((t) => m.role_title.startsWith(t)),
  );
  const analysts = data.filter(
    (m) => !["President", "Vice President"].some((t) => m.role_title.startsWith(t)),
  );
  return { exec, analysts };
}

export async function getEvents(type?: string): Promise<EventPublic[]> {
  const path = type ? `/web/v1/events?type=${type}` : "/web/v1/events";
  const data = await apiFetch<EventPublic[]>(path, "events");
  return data ?? PLACEHOLDER_EVENTS;
}

export async function getPage(slug: string): Promise<PagePublic | null> {
  return apiFetch<PagePublic>(`/web/v1/pages/${slug}`, `page-${slug}`);
}

export async function getRecruitmentSteps(): Promise<RecruitmentStep[]> {
  const data = await apiFetch<RecruitmentStep[]>("/web/v1/recruitment-steps", "recruitment-steps");
  return data ?? [];
}
