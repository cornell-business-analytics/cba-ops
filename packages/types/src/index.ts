export type { User, UserRole, UserSession, AllowedEmail } from "./models/user";
export type { Cohort, CohortPublic, Membership, MembershipDetail, Member, MemberPublic, ProfileEditRequest } from "./models/member";
export type {
  CandidateStatus,
  ApplicationCycle,
  Candidate,
  CoffeeChat,
  InterviewScore,
} from "./models/candidate";
export type { EventType, Event, EventPublic } from "./models/event";
export type {
  PageStatus,
  BlockType,
  Block,
  HeroBlock,
  RichTextBlock,
  TeamListBlock,
  CtaBlock,
  FaqBlock,
  FaqItem,
  EventListBlock,
  ProjectListBlock,
  SeoMeta,
  Page,
  PagePublic,
} from "./models/page";
export type {
  AnalyticsOverview,
  RecruitmentFunnelStage,
  RecruitmentCycleStat,
  RecruitmentAnalytics,
  CohortGrowthPoint,
  MembersAnalytics,
} from "./models/analytics";
export type { DesignRequestStatus, DesignRequest, DesignRequestStatusCheck } from "./models/design-request";

export interface RecruitmentStep {
  title: string;
  desc?: string;
}

export interface ApiError {
  detail: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}
