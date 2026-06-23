import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Linkedin } from "lucide-react";
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
          <div className="relative w-56 h-56 rounded-2xl overflow-hidden flex-shrink-0 bg-cba-dark">
            {member.headshot_url ? (
              <Image
                src={member.headshot_url}
                alt={member.name}
                fill
                className="object-cover object-top"
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
                <Linkedin className="h-4 w-4" />
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
