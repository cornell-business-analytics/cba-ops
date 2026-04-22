import type { MemberPublic } from "@cba/types";
import { MemberCard } from "./MemberCard";

interface TeamGridProps {
  exec: MemberPublic[];
  analysts: MemberPublic[];
}

export function TeamGrid({ exec, analysts }: TeamGridProps) {
  return (
    <section className="container-section py-16" aria-label="Team">
      <div>
        <h2 className="text-2xl font-bold text-cba-dark">Executive Board</h2>
        <div className="mt-8 grid grid-cols-2 gap-8 sm:grid-cols-4">
          {exec.map((member) => (
            <MemberCard key={member.id} member={member} />
          ))}
        </div>
      </div>

      {analysts.length > 0 && (
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-cba-dark">Analysts</h2>
          <div className="mt-8 grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
            {analysts.map((member) => (
              <MemberCard key={member.id} member={member} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
