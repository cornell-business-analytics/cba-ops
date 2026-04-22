export interface AnalyticsOverview {
  totalMembers: number;
  activeCandidates: number;
  publishedPages: number;
  eventsThisSemester: number;
}

export interface RecruitmentFunnelStage {
  stage: string;
  count: number;
}

export interface RecruitmentAnalytics {
  cycleId: string;
  cycleName: string;
  funnel: RecruitmentFunnelStage[];
  totalApplied: number;
  conversionRate: number;
}

export interface CohortGrowthPoint {
  cohort: string;
  memberCount: number;
}
