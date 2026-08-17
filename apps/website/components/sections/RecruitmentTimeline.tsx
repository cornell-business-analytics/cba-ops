import type { EventPublic } from "@cba/types";
import { linkify } from "@/lib/linkify";

interface RecruitmentTimelineProps {
  events: EventPublic[];
  large?: boolean;
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

export function RecruitmentTimeline({ events, large }: RecruitmentTimelineProps) {
  if (events.length === 0) {
    return (
      <p className="text-gray-500">No upcoming recruitment events. Check back soon.</p>
    );
  }

  return (
    <ol className={`relative border-l-2 border-cba-green/30 ${large ? "space-y-12" : "space-y-8"}`} aria-label="Recruitment timeline">
      {events.map((event) => (
        <li key={event.id} className={large ? "ml-8" : "ml-6"}>
          <span className={`absolute flex items-center justify-center rounded-full bg-cba-green ring-4 ring-white ${large ? "-left-3 h-6 w-6" : "-left-2 h-4 w-4"}`} />
          <span className={`mb-2 inline-block rounded-full bg-cba-green/10 font-medium text-cba-green ${large ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs"}`}>
            {typeLabel[event.type] ?? event.type}
          </span>
          <h3 className={`font-semibold text-cba-dark ${large ? "text-2xl" : "text-base"}`}>{event.title}</h3>
          <time className={large ? "text-base text-gray-500" : "text-sm text-gray-500"}>{formatDate(event.event_date)}</time>
          {event.location && (
            <p className={large ? "text-base text-gray-500" : "text-sm text-gray-500"}>{event.location}</p>
          )}
          {event.description && (
            <p className={`whitespace-pre-line text-gray-600 ${large ? "mt-2 text-base" : "mt-1 text-sm"}`}>
              {linkify(event.description)}
            </p>
          )}
          {event.link_url && (
            <a
              href={event.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1.5 rounded-md bg-cba-green font-semibold text-white transition-colors hover:bg-cba-dark ${large ? "mt-4 px-6 py-3 text-base" : "mt-3 px-4 py-2 text-sm"}`}
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
                className={large ? "h-4 w-4" : "h-3.5 w-3.5"}
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
