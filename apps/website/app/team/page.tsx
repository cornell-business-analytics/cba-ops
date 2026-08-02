import type { Metadata } from "next";
import { Hero } from "@/components/sections/Hero";
import { TeamGrid } from "@/components/sections/TeamGrid";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { getMembers, getPage } from "@/lib/api";
import { buildMetadata } from "@/lib/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("team");
  return buildMetadata(page, {
    title: "Team",
    description: "Meet the Cornell Business Analytics team — our executive board and analysts.",
  });
}

export default async function TeamPage() {
  const page = await getPage("team");

  if (page?.blocks.length) {
    return (
      <>
        {page.blocks.map((block, i) => (
          <BlockRenderer key={i} block={block} />
        ))}
      </>
    );
  }

  const { eboard, directors, pms, analysts, abroad } = await getMembers();
  return (
    <>
      <Hero heading="Meet the team" />
      <TeamGrid eboard={eboard} directors={directors} pms={pms} analysts={analysts} abroad={abroad} />
    </>
  );
}
