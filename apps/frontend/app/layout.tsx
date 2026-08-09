import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { auth } from "@/auth";
import { Providers } from "./providers";
import "./globals.css";

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "CBA Ops",
  description: "Cornell Business Analytics internal operations platform",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={poppins.className}>
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
