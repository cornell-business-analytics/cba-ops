import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Linkedin, ArrowLeft } from "lucide-react";
import { getMember, getMembers } from "@/lib/api";

export const revalidate = 3600;

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
  const { eboard, directors, pms, analysts } = await getMembers();
  return [...eboard, ...directors, ...pms, ...analysts].map((m) => ({ id: m.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const member = await getMember(id);
  if (!member) return {};
  return {
    title: member.name,
    description: member.bio ?? `${member.name} — ${member.role_title} at Cornell Business Analytics.`,
  };
}

function ProfileField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-cba-green">{label}</p>
      <p className="mt-1 text-sm text-gray-700 whitespace-pre-line">{value}</p>
    </div>
  );
}

export default async function MemberPage({ params }: Props) {
  const { id } = await params;
  const member = await getMember(id);
  if (!member) notFound();

  const initials = member.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");

  return (
    <main className="bg-cba-gray min-h-screen">
      <div className="container-section py-10 sm:py-16">
        <Link
          href="/team"
          className="inline-flex items-center gap-1 text-sm text-cba-green hover:text-cba-green-dark font-medium mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to team
        </Link>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex flex-col md:flex-row gap-0">
            {/* Left: headshot */}
            <div className="md:w-72 flex-shrink-0">
              <div className="relative w-full h-72 md:h-full min-h-72 bg-cba-dark flex items-center justify-center">
                {member.headshot_url ? (
                  <Image
                    src={member.headshot_url}
                    alt={member.name}
                    fill
                    className="object-cover object-top"
                  />
                ) : (
                  <span className="text-6xl font-bold text-white select-none">{initials}</span>
                )}
              </div>
            </div>

            {/* Right: profile info */}
            <div className="flex-1 p-8 space-y-6">
              <div>
                <h1 className="font-display text-3xl font-bold text-cba-dark">{member.name}</h1>
                <p className="mt-1 text-lg font-medium text-cba-green">{member.role_title}</p>
                {(member.major || member.grad_year) && (
                  <p className="mt-1 text-sm text-gray-500">
                    {[member.major, member.grad_year ? `Class of ${member.grad_year}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <ProfileField label="Email" value={member.email} />
                <ProfileField label="Hometown" value={member.hometown} />
                <ProfileField label="Campus Involvements" value={member.campus_involvements} />
                <ProfileField label="Professional Experience" value={member.professional_experience} />
                <ProfileField label="Interests" value={member.interests} />
              </div>

              {member.bio && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-cba-green">Bio</p>
                  <p className="mt-1 text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                    {member.bio}
                  </p>
                </div>
              )}

              {member.linkedin_url && (
                <a
                  href={member.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-md bg-cba-green px-4 py-2 text-sm font-semibold text-white hover:bg-cba-green-dark transition-colors"
                >
                  <Linkedin className="h-4 w-4" />
                  LinkedIn
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
