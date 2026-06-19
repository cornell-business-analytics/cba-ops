import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getMembers, getMember } from "@/lib/api";
import { buildMetadata } from "@/lib/metadata";

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
  return buildMetadata(null, {
    title: member?.name ?? "Member",
    description: member ? `${member.name} — ${member.role_title}` : "Team member profile",
  });
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

  const fields: { label: string; value: string | null | undefined }[] = [
    { label: "Major", value: member.major },
    { label: "Graduation Year", value: member.grad_year },
    { label: "Hometown", value: member.hometown },
    { label: "Campus Involvements", value: member.campus_involvements },
    { label: "Professional Experience", value: member.professional_experience },
    { label: "Interests", value: member.interests },
  ];

  return (
    <div className="container-section py-16">
      <Link
        href="/team"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-cba-green hover:text-cba-green-dark"
      >
        ← Back to team
      </Link>

      <div className="mt-10 grid grid-cols-1 gap-12 lg:grid-cols-3">
        <div className="flex flex-col items-center lg:items-start">
          <div className="relative w-full max-w-xs aspect-square overflow-hidden rounded-xl bg-cba-dark">
            {member.headshot_url ? (
              <Image
                src={member.headshot_url}
                alt={member.name}
                fill
                className="object-cover object-top"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-6xl font-bold text-white">
                {initials}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-cba-dark sm:text-4xl">{member.name}</h1>
            <p className="mt-1 text-lg font-medium text-cba-green">{member.role_title}</p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {member.email && (
              <a
                href={`mailto:${member.email}`}
                className="text-sm text-gray-600 hover:text-cba-green"
              >
                {member.email}
              </a>
            )}
            {member.linkedin_url && (
              <a
                href={member.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md bg-cba-green px-3 py-1.5 text-sm font-medium text-white hover:bg-cba-green-dark"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
                LinkedIn
              </a>
            )}
          </div>

          <div className="space-y-6">
            {fields
              .filter((f) => f.value)
              .map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                    {label}
                  </p>
                  <p className="mt-1 leading-relaxed text-gray-700">{value}</p>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
