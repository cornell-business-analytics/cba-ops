export interface Cohort {
  id: string;
  semester: string;
}

export interface Membership {
  id: string;
  user_id: string;
  cohort_id: string;
  project_id: string | null;
  role_title: string;
  headshot_url: string | null;
  hometown: string | null;
  major: string | null;
  grad_year: string | null;
  campus_involvements: string | null;
  professional_experience: string | null;
  interests: string | null;
  bio: string | null;
  display_order: number;
  is_active: boolean;
}

export interface MemberPublic {
  id: string;
  name: string;
  email: string;
  role_title: string;
  major: string | null;
  grad_year: string | null;
  hometown: string | null;
  campus_involvements: string | null;
  professional_experience: string | null;
  interests: string | null;
  bio: string | null;
  headshot_url: string | null;
  cohort_semester: string;
}

export interface ProfileEditRequest {
  id: string;
  membership_id: string;
  reviewed_by_id: string | null;
  changes: Record<string, unknown>;
  status: "pending" | "approved" | "rejected";
  reviewer_note: string | null;
}

export interface MembershipDetail extends Membership {
  user_name: string;
  user_email: string;
}

// Keep old Member alias for compatibility
export type Member = Membership;
