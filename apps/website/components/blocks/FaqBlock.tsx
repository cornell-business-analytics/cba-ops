import type { FaqBlock } from "@cba/types";

export function FaqBlockRenderer({ block }: { block: FaqBlock }) {
  return (
    <section className="container-section py-16" aria-label={block.title ?? "FAQ"}>
      {block.title && (
        <h2 className="text-2xl font-bold text-cba-dark">{block.title}</h2>
      )}
      <dl className="mt-8 space-y-6">
        {block.items.map((item, i) => (
          <div key={i} className="border-b border-gray-200 pb-6 last:border-0">
            <dt className="font-semibold text-cba-dark">{item.question}</dt>
            <dd className="mt-2 leading-relaxed text-gray-600">{item.answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
