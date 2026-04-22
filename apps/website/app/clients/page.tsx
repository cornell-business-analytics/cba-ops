import type { Metadata } from "next";
import { Hero } from "@/components/sections/Hero";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Clients",
  description:
    "Partner with Cornell Business Analytics for data-driven consulting solutions.",
};

const services = [
  {
    title: "Data Analysis & Visualization",
    desc: "We clean, analyze, and visualize your data to surface the insights that matter.",
  },
  {
    title: "Statistical Modeling",
    desc: "From regression to machine learning, we build models tailored to your business questions.",
  },
  {
    title: "Market Research",
    desc: "Competitive landscape analysis, customer segmentation, and market sizing.",
  },
  {
    title: "Dashboard & Reporting",
    desc: "Interactive dashboards and automated reports so your team stays informed.",
  },
  {
    title: "Process Optimization",
    desc: "Identify bottlenecks and inefficiencies using data-driven process analysis.",
  },
];

export default function ClientsPage() {
  return (
    <>
      <Hero
        heading="Work with us"
        subheading="We partner with companies, nonprofits, and startups to deliver rigorous, data-backed solutions to their hardest problems."
        ctaLabel="Get in touch"
        ctaHref="/contact"
      />

      <section className="container-section py-16" aria-label="Services">
        <h2 className="text-3xl font-bold text-cba-dark">What we offer</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map(({ title, desc }) => (
            <div key={title} className="rounded-lg border border-gray-200 p-6">
              <h3 className="font-semibold text-cba-dark">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-cba-gray" aria-label="Why CBA">
        <div className="container-section py-16">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-3xl font-bold text-cba-dark">Why partner with CBA?</h2>
              <ul className="mt-6 space-y-4">
                {[
                  "Access Cornell's top analytical talent across engineering, business, statistics, and CS",
                  "Rigorous academic methodology applied to real business problems",
                  "Cost-effective — we're a student organization, not a consulting firm",
                ].map((point) => (
                  <li key={point} className="flex gap-3 text-gray-600">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-cba-green" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg bg-cba-dark p-8 text-white">
              <p className="font-display text-xl font-bold">Collaborate with us!</p>
              <p className="mt-3 text-gray-300">
                We take on a limited number of client projects each semester. Reach out early to
                discuss your needs.
              </p>
              <Link
                href="/contact"
                className="mt-6 inline-block rounded-md bg-cba-green px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cba-green-dark"
              >
                Contact us
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
