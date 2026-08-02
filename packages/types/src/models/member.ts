export interface Cohort {
  id: string;
  semester: string;
}

export type CohortPublic = Cohort;

export interface Membership {
  id: string;
  user_id: string;
  cohort_id: string;
  role_title: string;
  headshot_url: string | null;
  headshot_focal_x: number;
  headshot_focal_y: number;
  hometown: string | null;
  major: string | null;
  grad_year: string | null;
  campus_involvements: string | null;
  professional_experience: string | null;
  professional_is_interests: boolean;
  interests: string | null;
  bio: string | null;
  linkedin_url: string | null;
  display_order: number;
  is_active: boolean;
  website_role: string | null;
}

export interface MemberPublic {
  id: string;
  name: string;
  email: string;
  role: string;
  role_title: string;
  is_active: boolean;
  major: string | null;
  grad_year: string | null;
  hometown: string | null;
  campus_involvements: string | null;
  professional_experience: string | null;
  professional_is_interests: boolean;
  interests: string | null;
  bio: string | null;
  headshot_url: string | null;
  headshot_focal_x: number;
  headshot_focal_y: number;
  linkedin_url: string | null;
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
  user_role: string;
}

// Keep old Member alias for compatibility
export type Member = Membership;
