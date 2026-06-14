import type { TeamListBlock } from "@cba/types";
import { getMembers } from "@/lib/api";
import { TeamGrid } from "@/components/sections/TeamGrid";

export async function TeamListBlockRenderer({ block }: { block: TeamListBlock }) {
  const { eboard, directors, pms, analysts } = await getMembers();
  return (
    <section aria-label={block.title ?? "Team"}>
      {block.title && (
        <div className="container-section pt-16">
          <h2 className="text-2xl font-bold text-cba-dark">{block.title}</h2>
        </div>
      )}
      <TeamGrid eboard={eboard} directors={directors} pms={pms} analysts={analysts} />
    </section>
  );
}
