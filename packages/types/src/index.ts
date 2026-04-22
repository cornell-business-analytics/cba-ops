export type { User, UserRole, UserSession } from "./models/user";
export type { Cohort, Member, MemberPublic } from "./models/member";
export type {
  CandidateStatus,
  CycleStatus,
  ApplicationCycle,
  Candidate,
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
  RecruitmentAnalytics,
  CohortGrowthPoint,
} from "./models/analytics";

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
