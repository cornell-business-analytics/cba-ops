"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { CheckCircle, Clock, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createApi } from "@/lib/api";

const STATUS_CONFIG = {
  draft:     { label: "Draft",     icon: FileText,   variant: "outline"  as const, next: "review"    },
  review:    { label: "In Review", icon: Clock,      variant: "warning"  as const, next: "published" },
  published: { label: "Published", icon: CheckCircle,variant: "success"  as const, next: null        },
};

interface Props {
  slug: string;
  status: string;
}

export function PublishButton({ slug, status }: Props) {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const api = () => createApi(session?.accessToken);

  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];

  const publish = useMutation({
    mutationFn: () => api().post(`/ops/v1/pages/${slug}/publish`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["page", slug] });
      qc.invalidateQueries({ queryKey: ["pages"] });
    },
  });

  const setReview = useMutation({
    mutationFn: () => api().patch(`/ops/v1/pages/${slug}`, { status: "review" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["page", slug] }),
  });

  if (!config) return null;

  const Icon = config.icon;

  return (
    <div className="flex items-center gap-3">
      <Badge variant={config.variant}>
        <Icon className="mr-1 h-3 w-3" />
        {config.label}
      </Badge>

      {config.next === "review" && (
        <Button size="sm" variant="outline" onClick={() => setReview.mutate()} disabled={setReview.isPending}>
          Submit for review
        </Button>
      )}

      {config.next === "published" && (
        <Button size="sm" onClick={() => publish.mutate()} disabled={publish.isPending}>
          {publish.isPending ? "Publishing…" : "Publish"}
        </Button>
      )}
    </div>
  );
}
