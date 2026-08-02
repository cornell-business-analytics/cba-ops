import type { MemberPublic } from "@cba/types";
import { MemberCard } from "./MemberCard";

interface TeamGridProps {
  eboard: MemberPublic[];
  directors: MemberPublic[];
  pms: MemberPublic[];
  analysts: MemberPublic[];
  abroad: MemberPublic[];
}

interface GroupSectionProps {
  title: string;
  members: MemberPublic[];
  cols?: string;
}

function GroupSection({ title, members, cols = "sm:grid-cols-3 lg:grid-cols-4" }: GroupSectionProps) {
  if (members.length === 0) return null;
  return (
    <div>
      <h2 className="text-2xl font-bold text-cba-dark">{title}</h2>
      <div className={`mt-8 grid grid-cols-2 gap-6 ${cols}`}>
        {members.map((member) => (
          <MemberCard key={member.id} member={member} />
        ))}
      </div>
    </div>
  );
}

function eboardOrder(roleTitle: string): number {
  const t = roleTitle.toLowerCase();
  if (t.includes("president") && !t.includes("vice")) return 0;
  if (t.includes("treasur")) return 99;
  return 50;
}

export function TeamGrid({ eboard, directors, pms, analysts, abroad }: TeamGridProps) {
  const sortedEboard = [...eboard].sort((a, b) => eboardOrder(a.role_title) - eboardOrder(b.role_title));
  return (
    <section className="container-section py-16 space-y-16" aria-label="Team">
      <GroupSection title="Executive Board" members={sortedEboard} cols="sm:grid-cols-2 lg:grid-cols-4" />
      <GroupSection title="Directors" members={directors} cols="sm:grid-cols-2 lg:grid-cols-4" />
      <GroupSection title="Project Managers" members={pms} cols="sm:grid-cols-2 lg:grid-cols-4" />
      <GroupSection title="Analysts" members={analysts} cols="sm:grid-cols-2 lg:grid-cols-4" />
      <GroupSection title="Abroad" members={abroad} cols="sm:grid-cols-2 lg:grid-cols-4" />
    </section>
  );
}
