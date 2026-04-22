import type { MemberPublic, EventPublic } from "@cba/types";

export const PLACEHOLDER_EXEC: MemberPublic[] = [
  { id: "1", name: "Fadi Ismail", roleTitle: "President", headshotUrl: null, bio: null, linkedinUrl: null, displayOrder: 1, cohort: "Spring 2026" },
  { id: "2", name: "Tatum McLaughlin", roleTitle: "Vice President, Internal", headshotUrl: null, bio: null, linkedinUrl: null, displayOrder: 2, cohort: "Spring 2026" },
  { id: "3", name: "Patrick Rushford", roleTitle: "Vice President, External", headshotUrl: null, bio: null, linkedinUrl: null, displayOrder: 3, cohort: "Spring 2026" },
  { id: "4", name: "Charles Huang", roleTitle: "Vice President, Treasury", headshotUrl: null, bio: null, linkedinUrl: null, displayOrder: 4, cohort: "Spring 2026" },
];

export const PLACEHOLDER_ANALYSTS: MemberPublic[] = [
  { id: "5", name: "Director of Recruitment", roleTitle: "Director of Recruitment", headshotUrl: null, bio: null, linkedinUrl: null, displayOrder: 5, cohort: "Spring 2026" },
  { id: "6", name: "Director of Professional Development", roleTitle: "Director of Professional Development", headshotUrl: null, bio: null, linkedinUrl: null, displayOrder: 6, cohort: "Spring 2026" },
  { id: "7", name: "Project Manager", roleTitle: "Project Manager", headshotUrl: null, bio: null, linkedinUrl: null, displayOrder: 7, cohort: "Spring 2026" },
];

export const PLACEHOLDER_EVENTS: EventPublic[] = [
  {
    id: "1",
    title: "Spring 2026 Info Session",
    slug: "spring-2026-info-session",
    description: "Learn about CBA, meet current members, and find out how to apply.",
    eventDate: "2026-02-01T18:00:00Z",
    location: "Statler Hall 196",
    type: "info",
  },
  {
    id: "2",
    title: "Coffee Chats",
    slug: "coffee-chats-spring-2026",
    description: "One-on-one conversations with CBA members to learn more about the club.",
    eventDate: "2026-02-08T14:00:00Z",
    location: "Libe Café",
    type: "recruitment",
  },
];
