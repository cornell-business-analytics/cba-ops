import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { Linkedin } from "lucide-react";
import { getMembers, getMember } from "@/lib/api";

export const revalidate = 3600;

export async function generateStaticParams() {
  const { eboard, directors, pms, analysts } = await getMembers();
  const all = [...eboard, ...directors, ...pms, ...analysts];
  return all.map((m) => ({ id: m.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const member = await getMember(id);
  if (!member) return { title: "Member Not Found" };
  return {
    title: member.name,
    description: member.bio ?? `${member.name} — ${member.role_title}`,
  };
}

function ProfileField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 text-sm text-gray-700 whitespace-pre-line">{value}</p>
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
    <main className="container-section py-12 sm:py-16">
      <Link
        href="/team"
        className="inline-flex items-center gap-1.5 text-sm text-cba-green hover:text-cba-green-dark font-medium mb-10"
      >
        ← Back to team
      </Link>

      <div className="grid gap-10 lg:grid-cols-[280px_1fr]">
        <div className="flex flex-col items-center lg:items-start gap-4">
          <div className="relative w-56 h-56 rounded-2xl overflow-hidden bg-cba-dark flex-shrink-0">
            {member.headshot_url ? (
              <Image
                src={member.headshot_url}
                alt={member.name}
                fill
                className="object-cover object-top"
                sizes="(max-width: 1024px) 224px, 280px"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-5xl font-bold text-white">
                {initials}
              </div>
            )}
          </div>

          <div className="text-center lg:text-left">
            <h1 className="text-2xl font-bold text-cba-dark">{member.name}</h1>
            <p className="mt-1 text-base font-medium text-cba-green">{member.role_title}</p>
            {(member.major || member.grad_year) && (
              <p className="mt-0.5 text-sm text-gray-500">
                {[member.major, member.grad_year ? `Class of '${member.grad_year.slice(-2)}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>

          {member.linkedin_url && (
            <a
              href={member.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-cba-dark hover:border-cba-green hover:text-cba-green transition-colors"
            >
              <Linkedin className="h-4 w-4" />
              LinkedIn
            </a>
          )}
        </div>

        <div className="space-y-6">
          {member.bio && (
            <div>
              <h2 className="text-lg font-bold text-cba-dark mb-2">About</h2>
              <p className="text-sm leading-relaxed text-gray-600 whitespace-pre-line">{member.bio}</p>
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <ProfileField label="Email" value={member.email} />
            <ProfileField label="Hometown" value={member.hometown} />
            <ProfileField label="Campus Involvements" value={member.campus_involvements} />
            <ProfileField label="Professional Experience" value={member.professional_experience} />
            <ProfileField label="Interests" value={member.interests} />
          </div>
        </div>
      </div>
    </main>
  );
}
