import type { EventListBlock } from "@cba/types";
import { getEvents } from "@/lib/api";
import { RecruitmentTimeline } from "@/components/sections/RecruitmentTimeline";

export async function EventListBlockRenderer({ block }: { block: EventListBlock }) {
  const all = await getEvents(block.eventType ?? undefined);
  const events = block.limit ? all.slice(0, block.limit) : all;

  return (
    <section className="container-section py-16" aria-label={block.title ?? "Events"}>
      {block.title && (
        <h2 className="mb-8 text-2xl font-bold text-cba-dark">{block.title}</h2>
      )}
      <RecruitmentTimeline events={events} />
    </section>
  );
}
