import type { Metadata } from "next";
import { Poppins, Jost } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import "./globals.css";

const poppins = Poppins({
  weight: ["600", "700", "800"],
  subsets: ["latin"],
  variable: "--font-poppins",
  display: "swap",
});

const jost = Jost({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jost",
  display: "swap",
});


export const metadata: Metadata = {
  metadataBase: new URL(
    process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://cornellbusinessanalytics.org",
  ),
  title: {
    default: "Cornell Business Analytics Club",
    template: "%s | Cornell Business Analytics Club",
  },
  description:
    "Data-driven solutions for data-driven clients. Cornell's premier student analytics consulting organization.",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Cornell Business Analytics Club",
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${poppins.variable} ${jost.variable}`}>
      <body className="flex min-h-screen flex-col">
        <Nav />
        <main className="flex-1">
          {children}
        </main>
        <Footer />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
