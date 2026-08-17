import path from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../../"),
  images: {
    // Vercel bills image optimization per transformation (unique source image ×
    // width × quality), and the plan's quota was exhausted — every /_next/image
    // request site-wide started returning
    // `402 OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED`, so no images rendered at
    // all. Each design-request image swap creates a brand-new source image and
    // burns a fresh set of transformations, which is what drained it.
    //
    // Uploads are now re-encoded to a 2560px long edge before they ever reach
    // the repo (apps/backend/app/services/images.py) and the committed assets
    // have been re-encoded to match, so the optimizer has little left to do.
    // Serving them straight from the CDN costs nothing and cannot run out.
    //
    // Trade-off: no automatic WebP/AVIF conversion and no responsive srcset, so
    // mobile downloads the full-size asset. If the club moves to a Vercel plan
    // with enough transformation quota, delete this line to turn optimization
    // back on — nothing else depends on it.
    unoptimized: true,
    minimumCacheTTL: 2592000, // 30 days — transformed images are cached much longer
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.cloudflare.com",
      },
      {
        protocol: "https",
        hostname: "**.r2.dev",
      },
    ],
  },
};

export default nextConfig;
