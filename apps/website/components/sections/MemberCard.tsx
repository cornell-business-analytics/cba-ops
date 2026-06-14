import Image from "next/image";
import type { MemberPublic } from "@cba/types";

interface MemberCardProps {
  member: MemberPublic;
}

export function MemberCard({ member }: MemberCardProps) {
  return (
    <div className="flex flex-col rounded-lg border border-gray-100 bg-white overflow-hidden shadow-sm">
      <div className="relative h-48 w-full bg-cba-dark/10 flex-shrink-0">
        {member.headshot_url ? (
          <Image
            src={member.headshot_url}
            alt={member.name}
            fill
            className="object-cover object-top"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-cba-dark text-4xl font-bold text-white">
            {member.name
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 p-4">
        <div>
          <p className="font-semibold text-cba-dark">{member.name}</p>
          <p className="text-sm text-cba-green font-medium">{member.role_title}</p>
          {(member.major || member.grad_year) && (
            <p className="mt-0.5 text-xs text-gray-500">
              {[member.major, member.grad_year ? `'${member.grad_year.slice(-2)}` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          {member.hometown && (
            <p className="text-xs text-gray-400">{member.hometown}</p>
          )}
        </div>

        {member.campus_involvements && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">On Campus</p>
            <p className="mt-0.5 text-xs text-gray-600 line-clamp-2">{member.campus_involvements}</p>
          </div>
        )}

        {member.professional_experience && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Experience</p>
            <p className="mt-0.5 text-xs text-gray-600 line-clamp-2">{member.professional_experience}</p>
          </div>
        )}

        {member.interests && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Interests</p>
            <p className="mt-0.5 text-xs text-gray-600 line-clamp-2">{member.interests}</p>
          </div>
        )}

        <div className="mt-auto flex items-center gap-3 pt-1 border-t border-gray-100">
          {member.email && (
            <a
              href={`mailto:${member.email}`}
              className="text-xs text-cba-green hover:underline truncate"
            >
              {member.email}
            </a>
          )}
          {member.linkedin_url && (
            <a
              href={member.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto flex-shrink-0 text-xs font-medium text-cba-green hover:text-cba-green-dark"
            >
              LinkedIn →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
