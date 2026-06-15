import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Hero } from "@/components/sections/Hero";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { getPage } from "@/lib/api";
import { buildMetadata } from "@/lib/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("home");
  return buildMetadata(page, {
    title: "Cornell Business Analytics",
    description:
      "Data-driven solutions for data-driven clients. Cornell's premier student analytics consulting organization.",
  });
}

export default async function HomePage() {
  const page = await getPage("home");

  if (page?.blocks.length) {
    return (
      <>
        {page.blocks.map((block, i) => (
          <BlockRenderer key={i} block={block} />
        ))}
      </>
    );
  }

  return (
    <>
      <Hero
        heading="Data-driven solutions for data-driven clients."
        subheading="Cornell Business Analytics is the first student-run analytics consulting organization delivering data-backed insights to real clients."
        ctaLabel="Apply now"
        ctaHref="/recruitment"
        image="/group.jpg"
      />

      <section className="bg-cba-gray" aria-label="Mission">
        <div className="container-section py-24 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-cba-green">Our mission</p>
          <p className="mx-auto mt-6 max-w-3xl font-display text-3xl font-bold leading-snug text-cba-dark sm:text-4xl lg:text-5xl">
            Cornell Business Analytics bridges academic rigor and real-world impact — training analysts to think critically, communicate clearly, and deliver work that moves the needle.
          </p>
        </div>
      </section>

      {[
        {
          title: "Turning Data Into Decisions",
          image: "/front/pillar-consulting.jpg",
          alt: "CBA members presenting analysis to a client",
          desc: "We work alongside companies, institutions, and nonprofits to answer hard questions with rigorous analysis — not guesswork.",
        },
        {
          title: "Developing Analytical Leaders",
          image: "/front/pillar-education.jpg",
          alt: "CBA workshop session",
          desc: "Members build real skills through client projects — from wrangling messy datasets to presenting findings to senior stakeholders.",
        },
        {
          title: "Building Lasting Community",
          image: "/front/pillar-community.jpg",
          alt: "CBA members at a social event",
          desc: "CBA is a community of Cornell's sharpest analytical minds, connected across industries and cohorts long after graduation.",
        },
      ].map(({ title, image, alt, desc }, i) => (
        <section key={title} className="flex flex-col md:flex-row min-h-[50vh]">
          <div className={`relative w-full md:w-1/2 min-h-[40vw] md:min-h-0 bg-cba-gray ${i % 2 === 1 ? "md:order-2" : ""}`}>
            <Image src={image} alt={alt} fill className="object-cover" />
          </div>
          <div className={`w-full md:w-1/2 flex items-center bg-white ${i % 2 === 1 ? "md:order-1" : ""}`}>
            <div className="px-8 py-14 md:px-16 lg:px-20">
              <p className="text-xs font-semibold uppercase tracking-widest text-cba-green">0{i + 1}</p>
              <h2 className="mt-3 font-display text-3xl font-bold text-cba-dark lg:text-4xl">{title}</h2>
              <p className="mt-4 max-w-sm text-base leading-relaxed text-gray-600">{desc}</p>
            </div>
          </div>
        </section>
      ))}

      <section className="bg-cba-green text-white" aria-label="Call to action">
        <div className="container-section py-16 text-center">
          <h2 className="font-display text-3xl font-bold">Ready to join?</h2>
          <p className="mt-4 text-lg text-green-100">
            CBA recruits analysts, project managers, and operations roles at the start of each semester. Follow our Instagram and check back here for cycle dates.
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
