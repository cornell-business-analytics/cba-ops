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

const pastClients = [
  {
    label: "firm developing voice technology for call center automation",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12">
        <rect x="5" y="2" width="14" height="20" rx="2" />
        <line x1="9" y1="7" x2="15" y2="7" />
        <line x1="9" y1="11" x2="15" y2="11" />
        <circle cx="12" cy="17" r="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    label: "fashion startup based in the Bay Area",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12">
        <path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.57a1 1 0 00.99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.84l.58-3.57a2 2 0 00-1.34-2.23z" />
      </svg>
    ),
  },
  {
    label: "US government department",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12">
        <path d="M3 22V11M21 22V11M12 2L2 11h20L12 2z" />
        <rect x="7" y="15" width="3" height="7" />
        <rect x="14" y="15" width="3" height="7" />
        <line x1="3" y1="22" x2="21" y2="22" />
      </svg>
    ),
  },
  {
    label: "sports analytics firm",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12">
        <line x1="18" y1="20" x2="18" y2="8" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="13" />
        <line x1="2" y1="20" x2="22" y2="20" />
      </svg>
    ),
  },
  {
    label: "leading yogurt company",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12">
        <path d="M7 2h10l2 5H5l2-5z" />
        <path d="M5 7l1.5 13a2 2 0 002 2h7a2 2 0 002-2L19 7" />
        <line x1="9" y1="11" x2="15" y2="11" />
      </svg>
    ),
  },
  {
    label: "Fortune 100 auto maker",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12">
        <path d="M2 13l3.5-6h13L22 13v3H2v-3z" />
        <circle cx="6.5" cy="16.5" r="1.5" />
        <circle cx="17.5" cy="16.5" r="1.5" />
      </svg>
    ),
  },
  {
    label: "leading airline carrier",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12">
        <path d="M21 16V14l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
      </svg>
    ),
  },
  {
    label: "sustainably sourced coffee company",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12">
        <path d="M18 8h1a4 4 0 010 8h-1" />
        <path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" />
        <line x1="6" y1="1" x2="6" y2="4" />
        <line x1="10" y1="1" x2="10" y2="4" />
        <line x1="14" y1="1" x2="14" y2="4" />
      </svg>
    ),
  },
];

function DonutChart() {
  const r = 70;
  const circ = 2 * Math.PI * r; // ≈ 439.8
  const greenLen = circ * 0.87;
  const limeLen = circ * 0.07;

  return (
    <svg viewBox="0 0 200 200" className="w-48 h-48" aria-label="8 to 10 week project duration">
      {/* Track */}
      <circle cx="100" cy="100" r={r} fill="none" stroke="#e5e7eb" strokeWidth="18" />
      {/* Green arc */}
      <circle
        cx="100" cy="100" r={r}
        fill="none"
        stroke="#1B7A3C"
        strokeWidth="18"
        strokeDasharray={`${greenLen} ${circ - greenLen}`}
        strokeLinecap="round"
        transform="rotate(-90 100 100)"
      />
      {/* Lime arc */}
      <circle
        cx="100" cy="100" r={r}
        fill="none"
        stroke="#8DC63F"
        strokeWidth="18"
        strokeDasharray={`${limeLen} ${circ - limeLen}`}
        strokeDashoffset={-(greenLen - 4)}
        strokeLinecap="round"
        transform="rotate(-90 100 100)"
      />
      <text x="100" y="93" textAnchor="middle" fontSize="22" fontWeight="700" fill="#0f2d1a" fontFamily="system-ui, sans-serif">8–10</text>
      <text x="100" y="116" textAnchor="middle" fontSize="13" fill="#6b7280" fontFamily="system-ui, sans-serif">Weeks</text>
    </svg>
  );
}

export default function ClientsPage() {
  return (
    <>
      <Hero
        heading="Work with us"
        subheading="We partner with companies, nonprofits, and startups to deliver rigorous, data-backed solutions to their hardest problems."
        ctaLabel="Get in touch"
        ctaHref="/contact"
      />

      {/* What we offer */}
      <section className="container-section py-16" aria-label="Services">
        <h2 className="text-3xl font-bold text-cba-dark">What we offer</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-6">
          {services.map(({ title, desc }, i) => (
            <div
              key={title}
              className={`rounded-lg border border-gray-200 p-6 lg:col-span-2${
                i === 3 ? " lg:col-start-2" : i === 4 ? " lg:col-start-4" : ""
              }`}
            >
              <h3 className="font-semibold text-cba-dark">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Project Structure */}
      <section className="border-t border-gray-100 bg-cba-gray" aria-label="Project structure">
        <div className="container-section py-16">
          <h2 className="text-3xl font-bold text-cba-dark">Project Structure</h2>
          <p className="mt-4 max-w-2xl text-gray-600 leading-relaxed">
            Projects run for one academic semester (8–10 weeks) each Spring and Fall. Teams meet with
            clients weekly or bi-weekly.
          </p>

          <div className="mt-10 flex items-center justify-between max-w-xl">
            {/* Role breakdown */}
            <div className="space-y-5">
              {[
                { count: "1", label: "E-Board Advisor" },
                { count: "1–2", label: "Project Managers" },
                { count: "4–6", label: "Analysts" },
              ].map(({ count, label }) => (
                <div key={label} className="flex items-center gap-4">
                  <span className="min-w-[3.5rem] text-right font-display text-2xl font-bold text-cba-green">
                    {count}
                  </span>
                  <span className="text-base text-cba-dark">{label}</span>
                </div>
              ))}
            </div>

            {/* Donut chart */}
            <DonutChart />
          </div>
        </div>
      </section>

      {/* Past Projects */}
      <section className="container-section py-16" aria-label="Past projects">
        <h2 className="text-3xl font-bold text-cba-dark">Past Projects</h2>
        <p className="mt-4 max-w-2xl text-gray-600 leading-relaxed">
          Since its inception, Cornell Business Analytics has delivered high quality work
          to all its diverse clients. Below are some of the clients we've worked with.
        </p>

        <div className="mt-10 grid grid-cols-2 gap-8 sm:grid-cols-4">
          {pastClients.map(({ label, icon }) => (
            <div key={label} className="flex flex-col items-center gap-4 text-center">
              <div className="text-gray-400">{icon}</div>
              <p className="text-sm text-gray-500 leading-snug">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why CBA */}
      <section className="bg-cba-gray border-t border-gray-100" aria-label="Why CBA">
        <div className="container-section py-16">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-3xl font-bold text-cba-dark">Why partner with CBA?</h2>
              <ul className="mt-6 space-y-4">
                {[
                  "Access Cornell's top analytical talent across engineering, business, statistics, and CS",
                  "Rigorous academic methodology applied to real business problems",
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
