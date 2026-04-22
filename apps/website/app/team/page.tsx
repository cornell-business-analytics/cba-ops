import type { Metadata } from "next";
import { Hero } from "@/components/sections/Hero";
import { TeamGrid } from "@/components/sections/TeamGrid";
import { getMembers } from "@/lib/api";

export const metadata: Metadata = {
  title: "Team",
  description: "Meet the Cornell Business Analytics team — our executive board and analysts.",
};

export default async function TeamPage() {
  const { exec, analysts } = await getMembers();

  return (
    <>
      <Hero
        heading="Meet the team"
        subheading="Our members come from every corner of Cornell, united by a passion for data and a drive to make an impact."
      />
      <TeamGrid exec={exec} analysts={analysts} />
    </>
  );
}
