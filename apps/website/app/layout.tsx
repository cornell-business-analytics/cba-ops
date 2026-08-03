import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { PageTransition } from "@/components/layout/PageTransition";
import "./globals.css";

const roboto = Roboto({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-roboto",
  display: "swap",
});


export const metadata: Metadata = {
  metadataBase: new URL(
    process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://www.cornellbusinessanalytics.org",
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
    <html lang="en" className={`${roboto.variable} ${GeistSans.variable}`}>
      <body className="flex min-h-screen flex-col">
        <Nav />
        <main className="flex-1">
          <PageTransition>{children}</PageTransition>
        </main>
        <Footer />
      </body>
    </html>
  );
}
