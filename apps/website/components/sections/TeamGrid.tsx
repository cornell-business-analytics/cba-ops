import type { MemberPublic } from "@cba/types";
import { MemberCard } from "./MemberCard";

interface TeamGridProps {
  eboard: MemberPublic[];
  directors: MemberPublic[];
  pms: MemberPublic[];
  analysts: MemberPublic[];
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

export function TeamGrid({ eboard, directors, pms, analysts }: TeamGridProps) {
  const staff = [...directors, ...pms];
  return (
    <section className="container-section py-16 space-y-16" aria-label="Team">
      <GroupSection title="Executive Board" members={eboard} cols="sm:grid-cols-2 lg:grid-cols-4" />
      <GroupSection title="Directors & Project Managers" members={staff} cols="sm:grid-cols-2 lg:grid-cols-4" />
      <GroupSection title="Analysts" members={analysts} cols="sm:grid-cols-2 lg:grid-cols-4" />
    </section>
  );
}
