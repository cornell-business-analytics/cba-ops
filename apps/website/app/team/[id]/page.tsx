import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Linkedin } from "lucide-react";
import { getMembers, getMember } from "@/lib/api";

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
    title: `${member.name} — Cornell Business Analytics`,
    description: member.bio ?? `${member.name}, ${member.role_title} at Cornell Business Analytics.`,
  };
}

interface FieldProps {
  label: string;
  value: string | null | undefined;
}

function ProfileField({ label, value }: FieldProps) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-cba-green">{label}</p>
      <p className="mt-1 text-sm leading-relaxed text-gray-700">{value}</p>
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
    <main>
      <div className="bg-cba-dark py-8">
        <div className="container-section">
          <Link
            href="/team"
            className="inline-flex items-center gap-1.5 text-sm text-gray-300 hover:text-white transition-colors"
          >
            ← Back to team
          </Link>
        </div>
      </div>

      <section className="container-section py-12 md:py-16">
        <div className="grid gap-10 md:grid-cols-[280px_1fr] lg:gap-16">
          <div className="flex flex-col items-center md:items-start gap-4">
            <div className="relative w-56 h-56 md:w-full md:h-auto md:aspect-square rounded-2xl overflow-hidden bg-cba-dark flex-shrink-0">
              {member.headshot_url ? (
                <Image
                  src={member.headshot_url}
                  alt={member.name}
                  fill
                  className="object-cover object-top"
                  priority
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-5xl font-bold text-white">
                  {initials}
                </div>
              )}
            </div>

            {member.linkedin_url && (
              <a
                href={member.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-cba-dark hover:bg-gray-50 transition-colors"
              >
                <Linkedin className="h-4 w-4 text-[#0A66C2]" />
                LinkedIn
              </a>
            )}
          </div>

          <div className="space-y-8">
            <div>
              <h1 className="text-3xl font-bold text-cba-dark md:text-4xl">{member.name}</h1>
              <p className="mt-1 text-lg font-medium text-cba-green">{member.role_title}</p>
              {(member.major || member.grad_year) && (
                <p className="mt-1 text-sm text-gray-500">
                  {[member.major, member.grad_year ? `Class of '${member.grad_year.slice(-2)}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <ProfileField label="Hometown" value={member.hometown} />
              <ProfileField label="Email" value={member.email} />
            </div>

            <ProfileField label="Bio" value={member.bio} />
            <ProfileField label="Campus Involvements" value={member.campus_involvements} />
            <ProfileField label="Professional Experience" value={member.professional_experience} />
            <ProfileField label="Interests" value={member.interests} />
          </div>
        </div>
      </section>
    </main>
  );
}
