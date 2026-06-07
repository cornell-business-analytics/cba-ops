import type { RichTextBlock } from "@cba/types";

export function RichTextBlockRenderer({ block }: { block: RichTextBlock }) {
  return (
    <section className="container-section py-16">
      <div
        className="max-w-3xl leading-relaxed text-gray-700 [&_h1]:mb-4 [&_h1]:font-display [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:text-cba-dark [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-cba-dark [&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-cba-dark [&_a]:text-cba-green [&_a]:underline [&_a:hover]:text-cba-green-dark [&_li]:ml-4 [&_ol]:mt-2 [&_ol]:list-decimal [&_p]:mt-4 [&_ul]:mt-2 [&_ul]:list-disc"
        dangerouslySetInnerHTML={{ __html: block.content }}
      />
    </section>
  );
}
