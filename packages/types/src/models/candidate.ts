export type CandidateStatus =
  | "applied"
  | "coffee_chat"
  | "interviewing"
  | "offer"
  | "accepted"
  | "rejected"
  | "withdrawn";

export interface ApplicationCycle {
  id: string;
  name: string;
  open_date: string | null;
  close_date: string | null;
  is_active: boolean;
}

export interface Candidate {
  id: string;
  cycle_id: string;
  name: string;
  email: string;
  cornell_email: string;
  net_id: string;
  pronouns: string | null;
  grad_year: string | null;
  is_transfer: boolean;
  college: string[];
  major: string | null;
  resume_url: string | null;
  headshot_url: string | null;
  status: CandidateStatus;
  notes: string | null;
}

export interface CoffeeChat {
  id: string;
  candidate_id: string;
  member_id: string;
  score: number | null;
  notes: string | null;
  completed: boolean;
}

export interface InterviewScore {
  id: string;
  session_id: string;
  candidate_id: string;
  member_id: string;
  category_id: string;
  numeric_score: number | null;
  ynm_score: string | null;
  comments: string | null;
}
