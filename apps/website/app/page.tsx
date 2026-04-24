import type { Metadata } from "next";
import Link from "next/link";
import { Hero } from "@/components/sections/Hero";
export const metadata: Metadata = {
  title: "Cornell Business Analytics",
  description:
    "Data-driven solutions for data-driven clients. Cornell's premier student analytics consulting organization.",
};

export default function HomePage() {
  return (
    <>
      <Hero
        heading="Data-driven solutions for data-driven clients."
        subheading="Cornell Business Analytics is the first student-run analytics consulting organization delivering data-backed insights to real clients."
        ctaLabel="Apply now"
        ctaHref="/recruitment"
        image="/group.JPG"
      />

      {/* Mission */}
      <section className="bg-cba-gray" aria-label="Mission">
        <div className="container-section py-24 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-cba-green">Our mission</p>
          <p className="mx-auto mt-6 max-w-3xl font-display text-3xl font-bold leading-snug text-cba-dark sm:text-4xl lg:text-5xl">
            Data-driven decision-making is central to how successful organizations operate.
          </p>
        </div>
      </section>


      {/* Pillars */}
      {[
        {
          title: "Turning Data Into Decisions",
          image: "/pillar-consulting.jpg",
          alt: "CBA members presenting analysis to a client",
        },
        {
          title: "Developing Analytical Leaders",
          image: "/pillar-education.jpg",
          alt: "CBA workshop session",
        },
        {
          title: "Building Lasting Community",
          image: "/pillar-community.jpg",
          alt: "CBA members at a social event",
        },
      ].map(({ title, image, alt }, i) => (
        <section key={title} className="flex flex-col md:flex-row min-h-[50vh]">
          <div className={`relative w-full md:w-1/2 min-h-[40vw] md:min-h-0 bg-cba-gray ${i % 2 === 1 ? "md:order-2" : ""}`}>
            <img src={image} alt={alt} className="absolute inset-0 h-full w-full object-cover" />
          </div>
          <div className={`w-full md:w-1/2 flex items-center bg-white ${i % 2 === 1 ? "md:order-1" : ""}`}>
            <div className="px-8 py-14 md:px-16 lg:px-20">
              <p className="text-xs font-semibold uppercase tracking-widest text-cba-green">0{i + 1}</p>
              <h2 className="mt-3 font-display text-3xl font-bold text-cba-dark lg:text-4xl">{title}</h2>
            </div>
          </div>
        </section>
      ))}

      {/* CTA */}
      <section className="bg-cba-green text-white" aria-label="Call to action">
        <div className="container-section py-16 text-center">
          <h2 className="font-display text-3xl font-bold">Ready to join?</h2>
          <p className="mt-4 text-lg text-green-100">
            Applications open each semester. Check back in the fall for recruitment details!
          </p>
          <Link
            href="/recruitment"
            className="mt-8 inline-block rounded-md bg-white px-8 py-3 text-sm font-semibold text-cba-green shadow transition-colors hover:bg-green-50"
          >
            Learn how to apply
          </Link>
        </div>
      </section>
    </>
  );
}
