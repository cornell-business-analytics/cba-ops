export interface AnalyticsOverview {
  total_members: number;
  active_candidates: number;
  published_pages: number;
  events_this_semester: number;
}

export interface RecruitmentCycleStat {
  cycle_id: string;
  name: string;
  total_applicants: number;
  offers: number;
  accepted: number;
  acceptance_rate: number;
}

export interface RecruitmentAnalytics {
  cycle_id: string | null;
  funnel: Record<string, number>;
  total_applicants: number;
  offers: number;
  acceptance_rate: number;
  cycles: RecruitmentCycleStat[];
}

export interface RecruitmentFunnelStage {
  stage: string;
  count: number;
}

export interface CohortGrowthPoint {
  semester: string;
  count: number;
}

export interface MembersAnalytics {
  cohort_growth: CohortGrowthPoint[];
  role_distribution: Record<string, number>;
}
