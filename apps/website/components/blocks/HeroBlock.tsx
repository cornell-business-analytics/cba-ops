import type { HeroBlock } from "@cba/types";
import { Hero } from "@/components/sections/Hero";

export function HeroBlockRenderer({ block }: { block: HeroBlock }) {
  return (
    <Hero
      heading={block.heading}
      subheading={block.subheading ?? undefined}
      ctaLabel={block.ctaLabel ?? undefined}
      ctaHref={block.ctaHref ?? undefined}
      image={block.imageUrl ?? undefined}
    />
  );
}
