import type { Block } from "@cba/types";
import { HeroBlockRenderer } from "./HeroBlock";
import { RichTextBlockRenderer } from "./RichTextBlock";
import { TeamListBlockRenderer } from "./TeamListBlock";
import { CtaBlockRenderer } from "./CtaBlock";
import { FaqBlockRenderer } from "./FaqBlock";
import { EventListBlockRenderer } from "./EventListBlock";
import { ProjectListBlockRenderer } from "./ProjectListBlock";

export function BlockRenderer({ block }: { block: Block }) {
  switch (block.type) {
    case "hero":
      return <HeroBlockRenderer block={block} />;
    case "rich_text":
      return <RichTextBlockRenderer block={block} />;
    case "team_list":
      return <TeamListBlockRenderer block={block} />;
    case "cta":
      return <CtaBlockRenderer block={block} />;
    case "faq":
      return <FaqBlockRenderer block={block} />;
    case "event_list":
      return <EventListBlockRenderer block={block} />;
    case "project_list":
      return <ProjectListBlockRenderer block={block} />;
    default:
      return null;
  }
}
