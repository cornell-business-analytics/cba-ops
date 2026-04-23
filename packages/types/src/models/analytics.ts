export interface AnalyticsOverview {
  total_members: number;
  active_candidates: number;
  published_pages: number;
  events_this_semester: number;
}

export interface RecruitmentAnalytics {
  cycle_id: string | null;
  funnel: Record<string, number>;
}

export interface RecruitmentFunnelStage {
  stage: string;
  count: number;
}

export interface CohortGrowthPoint {
  semester: string;
  count: number;
}
