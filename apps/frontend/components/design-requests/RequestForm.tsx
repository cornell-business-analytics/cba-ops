"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppSession } from "@/hooks/session-context";
import { createApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function RequestForm() {
  const session = useAppSession();
  const qc = useQueryClient();
  const api = () => createApi(session?.accessToken);
  const [description, setDescription] = useState("");

  const submit = useMutation({
    mutationFn: () => api().post("/ops/v1/design-requests", { description }),
    onSuccess: () => {
      setDescription("");
      qc.invalidateQueries({ queryKey: ["design-requests"] });
    },
  });

  return (
    <div className="rounded-lg border bg-white p-4 space-y-3">
      <div>
        <h2 className="text-sm font-medium">Request a website design change</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Describe what you&apos;d like changed on the public site. A director will review it, then
          an AI agent will make the change and open it for preview before anything goes live.
        </p>
      </div>
      <Textarea
        rows={3}
        placeholder="e.g. Make the hero section background a darker green"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        disabled={submit.isPending}
      />
      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={!description.trim() || submit.isPending}
          onClick={() => submit.mutate()}
        >
          {submit.isPending ? "Submitting…" : "Submit request"}
        </Button>
      </div>
    </div>
  );
}
