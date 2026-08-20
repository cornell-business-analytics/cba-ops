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
              <h2 className="text-3xl font-bold text-cba-dark">The process</h2>
              <ol className="mt-8 relative">
                {steps.map(({ title, desc, step_number }, i) => {
                  const hasNumber = step_number !== null && step_number !== undefined;
                  return (
                    <li key={i} className="relative flex gap-5 pb-8 last:pb-0">
                      {/* Vertical connector */}
                      {i < steps.length - 1 && (
                        <div className="absolute left-5 top-12 bottom-0 w-0.5 bg-gray-200" aria-hidden="true" />
                      )}
                      {/* Badge */}
                      <div className="relative z-10 flex-shrink-0">
                        {hasNumber ? (
                          <div className="h-10 w-10 rounded-full bg-cba-green flex flex-col items-center justify-center text-white shadow-sm">
                            <span className="text-[8px] font-semibold leading-none opacity-75 uppercase tracking-wide">Rnd</span>
                            <span className="text-sm font-bold leading-tight">{step_number}</span>
                          </div>
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gray-100 border-2 border-gray-200 flex items-center justify-center text-base">
                            ☕
                          </div>
                        )}
                      </div>
                      {/* Content */}
                      <div className="pt-1.5 flex-1">
                        <p className={`text-lg font-semibold leading-snug ${hasNumber ? "text-cba-dark" : "text-gray-600"}`}>
                          {title}
                        </p>
                        {desc && (
                          <p className="mt-1 text-gray-500 leading-relaxed">{desc}</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
