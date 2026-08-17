import type { Metadata } from "next";
import { Hero } from "@/components/sections/Hero";
import { RecruitmentTimeline } from "@/components/sections/RecruitmentTimeline";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { getEvents, getPage, getRecruitmentSteps, getRecruitmentNoEventsMessage } from "@/lib/api";
import { buildMetadata } from "@/lib/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("recruitment");
  return buildMetadata(page, {
    title: "Recruitment",
    description:
      "Apply to join Cornell Business Analytics. Learn about our recruitment process and upcoming events.",
  });
}

export default async function RecruitmentPage() {
  const page = await getPage("recruitment");

  if (page?.blocks.length) {
    return (
      <>
        {page.blocks.map((block, i) => (
          <BlockRenderer key={i} block={block} />
        ))}
      </>
    );
  }

  const [events, steps, noEventsMessage] = await Promise.all([
    getEvents("recruitment"),
    getRecruitmentSteps(),
    getRecruitmentNoEventsMessage(),
  ]);

  const hasEvents = events.length > 0;

  return (
    <>
      <Hero
        heading="Join CBA"
        subheading="See below for our fall recruitment details and events!"
        image="/recruitment/recruitFront.jpg"
        compact
      />

      <section className="container-section py-16">
        <div className={`grid gap-12 ${hasEvents ? "lg:grid-cols-2" : ""}`}>
          <div>
            <h2 className="text-3xl font-bold text-cba-dark">Upcoming events</h2>
            {hasEvents ? (
              <div className="mt-8">
                <RecruitmentTimeline events={events} large />
              </div>
            ) : (
              <p className="mt-4 text-gray-500 leading-relaxed">
                {noEventsMessage || "No upcoming events. Check back soon."}
              </p>
            )}
          </div>

          {steps.length > 0 && (
            <div className={!hasEvents ? "max-w-xl" : ""}>
              <h2 className="text-2xl font-bold text-cba-dark">The process</h2>
              <ol className="mt-6 space-y-6">
                {steps.map(({ title, desc }, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-cba-green text-sm font-bold text-white">
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-cba-dark">{title}</p>
                      {desc && <p className="mt-0.5 text-sm text-gray-600">{desc}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
