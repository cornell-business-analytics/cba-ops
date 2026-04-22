import type { MemberPublic } from "@cba/types";

interface MemberCardProps {
  member: MemberPublic;
}

export function MemberCard({ member }: MemberCardProps) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="h-24 w-24 overflow-hidden rounded-full bg-cba-dark/10 ring-2 ring-cba-dark/20">
        {member.headshotUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={member.headshotUrl}
            alt={member.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-cba-dark text-xl font-bold text-white">
            {member.name
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")}
          </div>
        )}
      </div>
      <p className="mt-3 font-semibold text-cba-dark">{member.name}</p>
      <p className="mt-0.5 text-sm text-gray-500">{member.roleTitle}</p>
      {member.linkedinUrl && (
        <a
          href={member.linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 text-xs text-cba-green hover:underline"
        >
          LinkedIn
        </a>
      )}
    </div>
  );
}
