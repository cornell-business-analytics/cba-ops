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
}
