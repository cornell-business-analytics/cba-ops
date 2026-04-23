"use client";

import { useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Upload, CheckCircle, Clock, XCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { createApi } from "@/lib/api";
import { useCurrentUser } from "@/hooks/use-current-user";
import type { MembershipDetail, ProfileEditRequest } from "@cba/types";

type ProfileFields = {
  role_title: string;
  major: string;
  grad_year: string;
  hometown: string;
  campus_involvements: string;
  professional_experience: string;
  interests: string;
  bio: string;
};

const EDIT_FIELDS: { key: keyof ProfileFields; label: string; multiline?: boolean }[] = [
  { key: "role_title", label: "Role Title" },
  { key: "major", label: "Major" },
  { key: "grad_year", label: "Graduation Year" },
  { key: "hometown", label: "Hometown" },
  { key: "campus_involvements", label: "Campus Involvements", multiline: true },
  { key: "professional_experience", label: "Professional Experience", multiline: true },
  { key: "interests", label: "Interests", multiline: true },
  { key: "bio", label: "Bio", multiline: true },
];

const ROLE_ORDER: Record<string, number> = { member: 0, pm: 1, director: 2, eboard: 3 };

function statusVariant(status: string) {
  if (status === "approved") return "success" as const;
  if (status === "rejected") return "destructive" as const;
  return "warning" as const;
}

function statusIcon(status: string) {
  if (status === "approved") return CheckCircle;
  if (status === "rejected") return XCircle;
  return Clock;
}

export default function MemberProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const { data: currentUser } = useCurrentUser();
  const qc = useQueryClient();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const api = () => createApi(session?.accessToken);

  const isDirectorOrAbove =
    currentUser ? (ROLE_ORDER[currentUser.role] ?? 0) >= ROLE_ORDER["director"] : false;

  const { data: membership, isLoading } = useQuery<MembershipDetail>({
    queryKey: ["members", id],
    queryFn: () => api().get(`/ops/v1/members/${id}`),
    enabled: !!session?.accessToken,
  });

  const { data: editRequests = [] } = useQuery<ProfileEditRequest[]>({
    queryKey: ["edit-requests"],
    queryFn: () => api().get("/ops/v1/edit-requests?pending_only=false"),
    enabled: !!session?.accessToken && isDirectorOrAbove,
  });
  const isOwnProfile = currentUser?.id === membership?.user_id;
  const canDirectEdit = isDirectorOrAbove;
  const canRequestEdit = isOwnProfile && !isDirectorOrAbove;
  const isReadOnly = !isDirectorOrAbove && !isOwnProfile;

  const { register, handleSubmit, formState: { isDirty } } = useForm<ProfileFields>({
    values: membership
      ? {
          role_title: membership.role_title ?? "",
          major: membership.major ?? "",
          grad_year: membership.grad_year ?? "",
          hometown: membership.hometown ?? "",
          campus_involvements: membership.campus_involvements ?? "",
          professional_experience: membership.professional_experience ?? "",
          interests: membership.interests ?? "",
          bio: membership.bio ?? "",
        }
      : undefined,
  });

  const directUpdate = useMutation({
    mutationFn: (data: Partial<ProfileFields>) =>
      api().patch(`/ops/v1/members/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members", id] }),
  });

  const requestEdit = useMutation({
    mutationFn: (changes: Partial<ProfileFields>) =>
      api().post(`/ops/v1/members/${id}/edit-requests`, { changes }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["edit-requests"] }),
  });

  const reviewRequest = useMutation({
    mutationFn: ({ reqId, status, note }: { reqId: string; status: string; note?: string }) =>
      api().patch(`/ops/v1/edit-requests/${reqId}/review`, { status, reviewer_note: note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["edit-requests"] });
      qc.invalidateQueries({ queryKey: ["members", id] });
    },
  });

  const onSubmit = (data: ProfileFields) => {
    const changes: Partial<ProfileFields> = {};
    for (const key of Object.keys(data) as (keyof ProfileFields)[]) {
      const val = data[key] || null;
      if (val !== (membership?.[key] ?? null)) {
        (changes as Record<string, unknown>)[key] = val;
      }
    }
    if (canDirectEdit) {
      directUpdate.mutate(changes);
    } else if (canRequestEdit) {
      requestEdit.mutate(changes);
    }
  };

  const handleHeadshotChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { upload_url, public_url } = await api().post<{ upload_url: string; public_url: string; key: string }>(
        "/ops/v1/assets/upload-url",
        { filename: file.name, content_type: file.type },
      );
      await fetch(upload_url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      await api().patch(`/ops/v1/members/${id}`, { headshot_url: public_url });
      qc.invalidateQueries({ queryKey: ["members", id] });
    } finally {
      setUploading(false);
    }
  };

  const memberEditRequests = editRequests.filter((r) => r.membership_id === id);

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!membership) return <div className="p-6 text-sm text-muted-foreground">Member not found.</div>;

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Members
      </button>

      {/* Header */}
      <div className="flex items-start gap-4">
        {/* Headshot */}
        <div className="relative group flex-shrink-0">
          <div className="w-20 h-20 rounded-full bg-muted overflow-hidden border">
            {membership.headshot_url ? (
              <img src={membership.headshot_url} alt={membership.user_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl font-semibold text-muted-foreground">
                {membership.user_name[0]}
              </div>
            )}
          </div>
          {(canDirectEdit || canRequestEdit) && (
            <>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                <Upload className="h-5 w-5" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleHeadshotChange} />
            </>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold">{membership.user_name}</h1>
          <p className="text-sm text-muted-foreground">{membership.user_email}</p>
          <p className="text-sm text-muted-foreground mt-0.5">{membership.role_title}</p>
        </div>

        {isReadOnly && (
          <Badge variant="outline">View only</Badge>
        )}
      </div>

      {/* Profile form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="rounded-lg border bg-white p-4 space-y-4">
          <h2 className="text-sm font-semibold">Profile</h2>
          <div className="grid grid-cols-2 gap-4">
            {EDIT_FIELDS.map(({ key, label, multiline }) => (
              <div key={key} className={`space-y-1 ${multiline ? "col-span-2" : ""}`}>
                <Label className="text-xs">{label}</Label>
                {multiline ? (
                  <textarea
                    {...register(key)}
                    disabled={isReadOnly}
                    rows={3}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                ) : (
                  <Input {...register(key)} disabled={isReadOnly} />
                )}
              </div>
            ))}
          </div>
        </div>

        {!isReadOnly && (
          <div className="flex justify-end gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={!isDirty || directUpdate.isPending || requestEdit.isPending}
            >
              {canDirectEdit
                ? directUpdate.isPending ? "Saving…" : "Save changes"
                : requestEdit.isPending ? "Submitting…" : "Submit for review"}
            </Button>
          </div>
        )}

        {requestEdit.isSuccess && (
          <p className="text-sm text-green-600 text-right">Edit request submitted.</p>
        )}
      </form>

      {/* Pending edit requests (directors only) */}
      {isDirectorOrAbove && memberEditRequests.length > 0 && (
        <div className="rounded-lg border bg-white overflow-hidden">
          <div className="px-4 py-3 border-b">
            <h2 className="text-sm font-semibold">Edit Requests</h2>
          </div>
          <div className="divide-y">
            {memberEditRequests.map((req) => {
              const Icon = statusIcon(req.status);
              return (
                <div key={req.id} className="px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant={statusVariant(req.status)}>
                      <Icon className="mr-1 h-3 w-3" />
                      {req.status}
                    </Badge>
                    {req.status === "pending" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => reviewRequest.mutate({ reqId: req.id, status: "rejected" })}
                          disabled={reviewRequest.isPending}
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => reviewRequest.mutate({ reqId: req.id, status: "approved" })}
                          disabled={reviewRequest.isPending}
                        >
                          Approve
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {Object.entries(req.changes).map(([field, value]) => (
                      <div key={field}>
                        <span className="font-medium">{field}</span>
                        {": "}
                        <span>{String(value)}</span>
                      </div>
                    ))}
                  </div>
                  {req.reviewer_note && (
                    <p className="text-xs text-muted-foreground italic">{req.reviewer_note}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
