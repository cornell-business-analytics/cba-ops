import type { EventPublic } from "@cba/types";
import { linkify } from "@/lib/linkify";

interface RecruitmentTimelineProps {
  events: EventPublic[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const typeLabel: Record<string, string> = {
  info: "Info Session",
  recruitment: "Recruitment Event",
  social: "Social",
  workshop: "Workshop",
};

export function RecruitmentTimeline({ events }: RecruitmentTimelineProps) {
  if (events.length === 0) {
    return (
      <p className="text-gray-500">No upcoming recruitment events. Check back soon.</p>
    );
  }

  return (
    <ol className="relative border-l-2 border-cba-green/30 space-y-8" aria-label="Recruitment timeline">
      {events.map((event) => (
        <li key={event.id} className="ml-6">
          <span className="absolute -left-2 flex h-4 w-4 items-center justify-center rounded-full bg-cba-green ring-4 ring-white" />
          <span className="mb-1 inline-block rounded-full bg-cba-green/10 px-2 py-0.5 text-xs font-medium text-cba-green">
            {typeLabel[event.type] ?? event.type}
          </span>
          <h3 className="text-base font-semibold text-cba-dark">{event.title}</h3>
          <time className="text-sm text-gray-500">{formatDate(event.event_date)}</time>
          {event.location && (
            <p className="text-sm text-gray-500">{event.location}</p>
          )}
          {event.description && (
            <p className="mt-1 whitespace-pre-line text-sm text-gray-600">
              {linkify(event.description)}
            </p>
          )}
          {event.link_url && (
            <a
              href={event.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-cba-green px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-cba-dark"
            >
              {event.link_label ?? "Sign up"}
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3.5 w-3.5"
              >
                <path d="M7 17 17 7M9 7h8v8" />
              </svg>
            </a>
          )}
        </li>
      ))}
    </ol>
  );
}
