import Image from "next/image";
import Link from "next/link";
import type { MemberPublic } from "@cba/types";

interface MemberCardProps {
  member: MemberPublic;
}

export function MemberCard({ member }: MemberCardProps) {
  return (
    <div className="relative flex flex-col rounded-lg border border-gray-100 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Overlay link covers the whole card; inner links sit above it via z-10 */}
      <Link
        href={`/team/${member.id}`}
        className="absolute inset-0 z-0"
        aria-label={`View ${member.name}'s profile`}
      />

      <div className="relative w-full aspect-square bg-cba-dark/10 flex-shrink-0">
        {member.headshot_url ? (
          <Image
            src={member.headshot_url}
            alt={member.name}
            fill
            className="object-cover"
            style={{ objectPosition: `${member.headshot_focal_x}% ${member.headshot_focal_y}%` }}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
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

      <div className="flex flex-col gap-2 p-4">
        <div>
          <p className="font-semibold text-cba-dark">{member.name}</p>
          <p className="text-sm text-cba-green font-medium">{member.role_title}</p>
          {(member.major || member.grad_year) && (
            <p className="mt-0.5 text-xs text-gray-500">
              {[member.major, member.grad_year ? `'${member.grad_year.slice(-2)}` : null]
                .filter(Boolean)
                .join(" ")}
            </p>
          )}
        </div>

        <div className="mt-auto flex items-center gap-3 pt-1 border-t border-gray-100">
          {member.email && (
            <a
              href={`mailto:${member.email}`}
              className="relative z-10 text-xs text-cba-green hover:underline truncate"
            >
              {member.email}
            </a>
          )}
          {member.linkedin_url && (
            <a
              href={member.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="relative z-10 ml-auto flex-shrink-0 text-xs font-medium text-cba-green hover:text-cba-green-dark"
            >
              LinkedIn →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
