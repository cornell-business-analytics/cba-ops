import Link from "next/link";
import type { CtaBlock } from "@cba/types";

export function CtaBlockRenderer({ block }: { block: CtaBlock }) {
  return (
    <section className="bg-cba-green text-white" aria-label="Call to action">
      <div className="container-section py-16 text-center">
        <h2 className="font-display text-3xl font-bold">{block.heading}</h2>
        {block.body && (
          <p className="mt-4 text-lg text-green-100">{block.body}</p>
        )}
        <Link
          href={block.buttonHref}
          className="mt-8 inline-block rounded-md bg-white px-8 py-3 text-sm font-semibold text-cba-green shadow transition-colors hover:bg-green-50"
        >
          {block.buttonLabel}
        </Link>
      </div>
    </section>
  );
}
