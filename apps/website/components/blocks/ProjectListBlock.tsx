import type { ProjectListBlock } from "@cba/types";

export function ProjectListBlockRenderer({ block }: { block: ProjectListBlock }) {
  return (
    <section className="container-section py-16" aria-label={block.title ?? "Projects"}>
      {block.title && (
        <h2 className="text-2xl font-bold text-cba-dark">{block.title}</h2>
      )}
      <p className="mt-4 text-gray-500">Project showcase coming soon.</p>
    </section>
  );
}
