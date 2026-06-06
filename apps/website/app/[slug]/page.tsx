import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPage } from "@/lib/api";
import { buildMetadata } from "@/lib/metadata";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug);
  return buildMetadata(page, { title: "Not Found" });
}

export default async function DynamicPage({ params }: Props) {
  const { slug } = await params;
  const page = await getPage(slug);

  if (!page) notFound();

  return (
    <>
      {page.blocks.map((block, i) => (
        <BlockRenderer key={i} block={block} />
      ))}
    </>
  );
}
