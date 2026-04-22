export type CandidateStatus =
  | "applied"
  | "screening"
  | "interview"
  | "offer"
  | "accepted"
  | "rejected"
  | "withdrawn";

export type CycleStatus = "upcoming" | "open" | "closed";

export interface ApplicationCycle {
  id: string;
  name: string;
  openDate: string;
  closeDate: string;
  status: CycleStatus;
}

export interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  gradYear: number | null;
  major: string | null;
  resumeUrl: string | null;
  status: CandidateStatus;
  cycleId: string;
  cycle?: ApplicationCycle;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
