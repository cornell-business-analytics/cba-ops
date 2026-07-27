import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMember, getMembers } from "@/lib/api";

export const revalidate = 3600;

export async function generateStaticParams() {
  const { eboard, directors, pms, analysts } = await getMembers();
  return [...eboard, ...directors, ...pms, ...analysts].map((m) => ({ id: m.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const member = await getMember(id);
  if (!member) return { title: "Member" };
  return {
    title: `${member.name} — CBA`,
    description: member.bio ?? `${member.name}, ${member.role_title} at Cornell Business Analytics`,
  };
}

interface ProfileFieldProps {
  label: string;
  value: string | null | undefined;
}

function ProfileField({ label, value }: ProfileFieldProps) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-cba-green">{label}</p>
      <p className="mt-1 text-gray-700 leading-relaxed">{value}</p>
    </div>
  );
}

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const member = await getMember(id);
  if (!member) notFound();

  const initials = member.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");

  return (
    <main className="container-section py-12">
      <Link
        href="/team"
        className="inline-flex items-center gap-1 text-sm text-cba-green hover:text-cba-green-dark mb-8"
      >
        ← Back to team
      </Link>

      <div className="grid gap-10 lg:grid-cols-[280px_1fr]">
        {/* Left column — headshot */}
        <div className="flex flex-col items-center lg:items-start gap-4">
          <div className="relative w-56 aspect-[3/4] rounded-2xl overflow-hidden flex-shrink-0 bg-cba-dark">
            {member.headshot_url ? (
              <Image
                src={member.headshot_url}
                alt={member.name}
                fill
                className="object-cover"
                style={{ objectPosition: `${member.headshot_focal_x}% ${member.headshot_focal_y}%` }}
                sizes="224px"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-5xl font-bold text-white">
                {initials}
              </div>
            )}
          </div>

          <div className="text-center lg:text-left">
            <h1 className="text-2xl font-bold text-cba-dark">{member.name}</h1>
            <p className="text-cba-green font-medium mt-0.5">{member.role_title}</p>
            {member.email && (
              <a
                href={`mailto:${member.email}`}
                className="mt-1 block text-sm text-gray-500 hover:text-cba-green"
              >
                {member.email}
              </a>
            )}
            {member.linkedin_url && (
              <a
                href={member.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-cba-green hover:text-cba-green-dark"
              >
                <svg
                  role="img"
                  viewBox="0 0 24 24"
                  className="h-4 w-4 fill-current"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
                LinkedIn
              </a>
            )}
          </div>
        </div>

        {/* Right column — profile fields */}
        <div className="space-y-6">
          {(member.major || member.grad_year || member.hometown) && (
            <div className="rounded-xl border border-gray-100 bg-white p-6 space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wide text-cba-dark">Background</h2>
              <ProfileField label="Major" value={member.major} />
              <ProfileField label="Graduation Year" value={member.grad_year} />
              <ProfileField label="Hometown" value={member.hometown} />
            </div>
          )}

          {(member.campus_involvements || member.professional_experience || member.interests) && (
            <div className="rounded-xl border border-gray-100 bg-white p-6 space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wide text-cba-dark">About</h2>
              <ProfileField label="Campus Involvements" value={member.campus_involvements} />
              <ProfileField label="Professional Experience" value={member.professional_experience} />
              <ProfileField label="Interests" value={member.interests} />
            </div>
          )}

          {member.bio && (
            <div className="rounded-xl border border-gray-100 bg-white p-6">
              <h2 className="text-sm font-bold uppercase tracking-wide text-cba-dark mb-3">Bio</h2>
              <p className="text-gray-700 leading-relaxed">{member.bio}</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
