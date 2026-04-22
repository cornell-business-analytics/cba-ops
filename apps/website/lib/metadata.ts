import type { Metadata } from "next";
import type { PagePublic } from "@cba/types";

export function buildMetadata(page: PagePublic | null, fallback: Metadata): Metadata {
  if (!page) return fallback;
  return {
    title: page.seo.title,
    description: page.seo.description ?? undefined,
    openGraph: {
      title: page.seo.title,
      description: page.seo.description ?? undefined,
      images: page.seo.ogImageUrl ? [page.seo.ogImageUrl] : [],
    },
  };
}
