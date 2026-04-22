import type { Metadata } from "next";
import { Hero } from "@/components/sections/Hero";
import {
  BusinessIcon, OperationsResearchIcon, EconomicsIcon, ComputerScienceIcon,
  FinanceAccountingIcon, DataScienceIcon, GovernmentPolicyIcon, MathStatisticsIcon,
  FinanceIcon, AerospaceIcon, MediaIcon, DefenseIcon,
  ECommerceIcon, EnergyIcon, ConsumerGoodsIcon, SoftwareIcon,
} from "@/components/icons/AboutIcons";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn about Cornell Business Analytics — our history, mission, and approach to analytics consulting.",
};

const majors = [
  { label: "Business", Icon: BusinessIcon },
  { label: "Operations Research", Icon: OperationsResearchIcon },
  { label: "Economics", Icon: EconomicsIcon },
  { label: "Computer Science", Icon: ComputerScienceIcon },
  { label: "Finance & Accounting", Icon: FinanceAccountingIcon },
  { label: "Data Science", Icon: DataScienceIcon },
  { label: "Government & Policy", Icon: GovernmentPolicyIcon },
  { label: "Math & Statistics", Icon: MathStatisticsIcon },
];

const placements = [
  { name: "Goldman Sachs", logo: "/logos/goldman-sachs.png" },
  { name: "McKinsey & Company", logo: "/logos/mckinsey.png" },
  { name: "BCG", logo: "/logos/bcg.png" },
  { name: "J.P. Morgan", logo: "/logos/jpmorgan.png" },
  { name: "BlackRock", logo: "/logos/blackrock.png" },
  { name: "Citadel", logo: "/logos/citadel.png" },
  { name: "Millennium", logo: "/logos/millennium.png" },
  { name: "Amazon", logo: "/logos/amazon.png" },
  { name: "Meta", logo: "/logos/meta.png" },
  { name: "Microsoft", logo: "/logos/microsoft.png" },
  { name: "Google", logo: "/logos/google.png" },
  { name: "Apple", logo: "/logos/apple.png" },
  { name: "Netflix", logo: "/logos/netflix.png" },
  { name: "Palantir", logo: "/logos/palantir.png" },
  { name: "Deloitte", logo: "/logos/deloitte.png" },
  { name: "Accenture", logo: "/logos/accenture.png" },
  { name: "EY Parthenon", logo: "/logos/ey-parthenon.png" },
  { name: "Capital One", logo: "/logos/capital-one.png" },
  { name: "Citi", logo: "/logos/citi.png" },
  { name: "UBS", logo: "/logos/ubs.png" },
  { name: "Susquehanna", logo: "/logos/susquehanna.png" },
  { name: "Stanford GSB", logo: "/logos/stanford-gsb.png" },
  { name: "MIT", logo: "/logos/mit.png" },
];

const industries = [
  { label: "Finance", Icon: FinanceIcon },
  { label: "Aerospace", Icon: AerospaceIcon },
  { label: "Media", Icon: MediaIcon },
  { label: "Defense", Icon: DefenseIcon },
  { label: "eCommerce", Icon: ECommerceIcon },
  { label: "Energy", Icon: EnergyIcon },
  { label: "Consumer Goods", Icon: ConsumerGoodsIcon },
  { label: "Software", Icon: SoftwareIcon },
];

export default function AboutPage() {
  return (
    <>
      <Hero
        heading="About CBA"
        image="/about.jpg"
      />

      <section className="container-section py-16">
        {/* Who we are + What we do */}
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold text-cba-dark">Who we are</h2>
            <p className="mt-4 leading-relaxed text-gray-600">
              Founded in 2016, Cornell Business Analytics is Cornell's first technical
              consulting club. We partner with on-campus and off-campus clients to deliver
              data-driven insights that drive real decisions while giving our members the
              hands-on experience that classrooms can't. We believe the best analysts are
              built through practice, not theory alone.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-cba-dark">What we do</h2>
            <ul className="mt-4 space-y-3">
              {[
                { title: "Client consulting", desc: "We partner with companies and organizations to deliver data-driven insights and recommendations." },
                { title: "Professional development", desc: "Regular workshops, speaker events, and industry panels to help members explore careers across tech, finance, consulting, and beyond." },
                { title: "Peer learning", desc: "Members learn from each other through project teams, mentorship, and collaborative problem solving." },
              ].map(({ title, desc }) => (
                <li key={title} className="flex gap-3">
                  <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-cba-green" />
                  <div>
                    <p className="font-semibold text-cba-dark">{title}</p>
                    <p className="text-sm text-gray-600">{desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Majors + Industries */}
        <div className="mt-16 rounded-lg bg-cba-gray p-8 sm:p-12">
          <h2 className="text-center text-3xl font-bold text-cba-dark">Our Members Are...</h2>
          <div className="mt-10 grid gap-12 lg:grid-cols-2">
            <div>
              <p className="text-lg font-semibold text-cba-green">
                A passionate group of students studying
              </p>
              <div className="mt-6 grid grid-cols-2 gap-4">
                {majors.map(({ label, Icon }) => (
                  <div key={label} className="flex items-center gap-3">
                    <Icon className="h-6 w-6 flex-shrink-0 text-cba-green" />
                    <span className="text-sm text-gray-700">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:border-l lg:border-gray-200 lg:pl-12">
              <p className="text-lg font-semibold text-cba-teal">
                Who have worked on projects in
              </p>
              <div className="mt-6 grid grid-cols-2 gap-4">
                {industries.map(({ label, Icon }) => (
                  <div key={label} className="flex items-center gap-3">
                    <Icon className="h-6 w-6 flex-shrink-0 text-cba-teal" />
                    <span className="text-sm text-gray-700">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Placements */}
          <div className="mt-10 border-t border-gray-200 pt-10">
            <p className="text-lg font-semibold text-cba-dark">
              Who go on to work at
            </p>
            <div className="mt-6 overflow-hidden">
              <div className="flex w-max animate-marquee items-center gap-12">
                {[...placements, ...placements].map(({ name, logo }, i) => (
                  <img
                    key={`${name}-${i}`}
                    src={logo}
                    alt={name}
                    className="h-12 w-auto object-contain"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

      </section>
    </>
  );
}
