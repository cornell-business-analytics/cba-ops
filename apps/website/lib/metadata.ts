import type { Metadata } from "next";
import type { PagePublic } from "@cba/types";

export function buildMetadata(page: PagePublic | null, fallback: Metadata): Metadata {
  if (!page) return fallback;
  return {
    title: page.seo_title ?? page.title,
    description: page.seo_description ?? undefined,
    openGraph: {
      title: page.seo_title ?? page.title,
      description: page.seo_description ?? undefined,
    },
  };
}
