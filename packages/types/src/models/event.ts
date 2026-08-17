export type EventType = "recruitment" | "social" | "info" | "workshop";

export interface Event {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  event_date: string;
  location: string | null;
  type: EventType;
  is_published: boolean;
  /** Optional call-to-action link. Backend guarantees http(s) only. */
  link_url: string | null;
  /** Button text for `link_url`. Falls back to a default when unset. */
  link_label: string | null;
  created_at: string;
}

export interface EventPublic {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  event_date: string;
  location: string | null;
  type: EventType;
  /** Optional call-to-action link. Backend guarantees http(s) only. */
  link_url: string | null;
  /** Button text for `link_url`. Falls back to a default when unset. */
  link_label: string | null;
}
