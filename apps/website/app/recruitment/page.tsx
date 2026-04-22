import type { Metadata } from "next";
import { Hero } from "@/components/sections/Hero";
import { RecruitmentTimeline } from "@/components/sections/RecruitmentTimeline";
import { getEvents } from "@/lib/api";

export const metadata: Metadata = {
  title: "Recruitment",
  description:
    "Apply to join Cornell Business Analytics. Learn about our recruitment process and upcoming events.",
};


export default async function RecruitmentPage() {
  const events = await getEvents("recruitment");

  return (
    <>
      <Hero
        heading="Join CBA"
        subheading="We recruit the most curious and driven analysts at Cornell. If that sounds like you, we'd love to meet."
      />

      <section className="container-section py-16">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold text-cba-dark">Upcoming events</h2>
            <div className="mt-8">
              <RecruitmentTimeline events={events} />
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-cba-dark">The process</h2>
            <ol className="mt-6 space-y-6">
              {[
                { step: "1", title: "Attend an info session", desc: "Learn about CBA and meet current members. No commitment required." },
                { step: "2", title: "Submit your application", desc: "A short form covering your background, interests, and a brief analytical question." },
                { step: "3", title: "Coffee chat", desc: "A casual conversation with a current member to get to know you." },
                { step: "4", title: "Case interview", desc: "A structured case to assess your analytical thinking. We provide prep resources." },
                { step: "5", title: "Decisions", desc: "We notify all applicants within one week of final interviews." },
              ].map(({ step, title, desc }) => (
                <li key={step} className="flex gap-4">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-cba-green text-sm font-bold text-white">
                    {step}
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
