export type EventType = "recruitment" | "social" | "info" | "workshop";

export interface Event {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  eventDate: string;
  location: string | null;
  type: EventType;
  isPublished: boolean;
  createdAt: string;
}

export interface EventPublic {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  eventDate: string;
  location: string | null;
  type: EventType;
}
