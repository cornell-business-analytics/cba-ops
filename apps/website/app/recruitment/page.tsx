import type { Metadata } from "next";
import { Hero } from "@/components/sections/Hero";
import { RecruitmentTimeline } from "@/components/sections/RecruitmentTimeline";
import { getEvents, getRecruitmentSteps } from "@/lib/api";

export const metadata: Metadata = {
  title: "Recruitment",
  description:
    "Apply to join Cornell Business Analytics. Learn about our recruitment process and upcoming events.",
};


export default async function RecruitmentPage() {
  const [events, steps] = await Promise.all([
    getEvents("recruitment"),
    getRecruitmentSteps(),
  ]);

  return (
    <>
      <Hero
        heading="Join CBA"
        subheading="Check back in the fall for recruitment details and events!"
        image="/recruitment/recruitFront.jpg"
        compact
      />

      <section className="container-section py-16">
        <div className={`grid gap-12 ${events.length > 0 ? "lg:grid-cols-2" : ""}`}>
          {events.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold text-cba-dark">Upcoming events</h2>
              <div className="mt-8">
                <RecruitmentTimeline events={events} />
              </div>
            </div>
          )}

          <div className={events.length === 0 ? "max-w-xl" : ""}>
            <h2 className="text-2xl font-bold text-cba-dark">The process</h2>
            <ol className="mt-6 space-y-6">
              {steps.map(({ title, desc }, i) => (
                <li key={i} className="flex gap-4">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-cba-green text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-cba-dark">{title}</p>
                    <p className="mt-0.5 text-sm text-gray-600">{desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
    </>
  );
}
