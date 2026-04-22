import type { MetadataRoute } from "next";

const BASE_URL =
  process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://www.cornellbusinessanalytics.org";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["/", "/about", "/team", "/clients", "/recruitment", "/contact"];

  return routes.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: route === "/" ? 1 : 0.8,
  }));
}
