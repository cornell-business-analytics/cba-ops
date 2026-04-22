export type PageStatus = "draft" | "review" | "published";

export type BlockType =
  | "hero"
  | "rich_text"
  | "team_list"
  | "cta"
  | "faq"
  | "event_list"
  | "project_list";

export interface HeroBlock {
  type: "hero";
  heading: string;
  subheading: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  imageUrl: string | null;
}

export interface RichTextBlock {
  type: "rich_text";
  content: string;
}

export interface TeamListBlock {
  type: "team_list";
  title: string | null;
  cohortId: string | null;
}

export interface CtaBlock {
  type: "cta";
  heading: string;
  body: string | null;
  buttonLabel: string;
  buttonHref: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqBlock {
  type: "faq";
  title: string | null;
  items: FaqItem[];
}

export interface EventListBlock {
  type: "event_list";
  title: string | null;
  eventType: string | null;
  limit: number | null;
}

export interface ProjectListBlock {
  type: "project_list";
  title: string | null;
}

export type Block =
  | HeroBlock
  | RichTextBlock
  | TeamListBlock
  | CtaBlock
  | FaqBlock
  | EventListBlock
  | ProjectListBlock;

export interface SeoMeta {
  title: string;
  description: string | null;
  ogImageUrl: string | null;
}

export interface Page {
  id: string;
  slug: string;
  title: string;
  status: PageStatus;
  seo: SeoMeta;
  blocks: Block[];
  publishedAt: string | null;
  updatedAt: string;
}

export interface PagePublic {
  slug: string;
  title: string;
  seo: SeoMeta;
  blocks: Block[];
  publishedAt: string;
}
