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
      <section className="border-b border-gray-100 bg-cba-gray" aria-label="Mission">
        <div className="container-section py-16">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold text-cba-dark">Our mission</h2>
            <p className="mt-4 text-lg leading-relaxed text-gray-600">
              Data-driven decision-making is central to how successful organizations operate. CBA
              exists to give Cornell students real project experience and a rigorous education in
              business analytics — and to foster a community of students committed to the field.
            </p>
          </div>
        
        </div>
      </section>


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
