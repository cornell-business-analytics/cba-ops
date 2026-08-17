"use client";

import { useAppSession } from "@/hooks/session-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createApi } from "@/lib/api";
import type { RecruitmentStep } from "@cba/types";

type FormValues = { steps: RecruitmentStep[] };

export default function RecruitmentStepsPage() {
  const session = useAppSession();
  const qc = useQueryClient();
  const api = () => createApi(session?.accessToken);

  const { data: steps = [] } = useQuery<RecruitmentStep[]>({
    queryKey: ["recruitment-steps"],
    queryFn: () => api().get("/ops/v1/settings/recruitment-steps"),
    enabled: !!session?.accessToken,
  });

  const { register, control, handleSubmit } = useForm<FormValues>({
    values: { steps },
  });

  const { fields, append, remove, move } = useFieldArray({ control, name: "steps" });

  const save = useMutation({
    mutationFn: (data: FormValues) =>
      api().put("/ops/v1/settings/recruitment-steps", data.steps),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recruitment-steps"] }),
  });

  const { data: noEventsData } = useQuery<{ message: string }>({
    queryKey: ["recruitment-no-events-message"],
    queryFn: () => api().get("/ops/v1/settings/recruitment-no-events-message"),
    enabled: !!session?.accessToken,
  });

  const [noEventsMessage, setNoEventsMessage] = useState("");
  useEffect(() => {
    if (noEventsData?.message !== undefined) setNoEventsMessage(noEventsData.message);
  }, [noEventsData]);

  const saveMessage = useMutation({
    mutationFn: () =>
      api().put("/ops/v1/settings/recruitment-no-events-message", { message: noEventsMessage }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recruitment-no-events-message"] }),
  });

  return (
    <div className="p-6 max-w-2xl space-y-10">
      <div>
        <h1 className="text-xl font-semibold">Recruitment Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure the public recruitment page.
        </p>
      </div>

      {/* No-events message */}
      <div className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">No Events Message</h2>
          <p className="text-sm text-muted-foreground">
            Shown on the recruitment page when there are no upcoming events.
          </p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Message</Label>
          <Textarea
            value={noEventsMessage}
            onChange={(e) => setNoEventsMessage(e.target.value)}
            placeholder="e.g. Applications open Fall 2026 — check back soon!"
            rows={3}
          />
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={() => saveMessage.mutate()} disabled={saveMessage.isPending}>
            {saveMessage.isPending ? "Saving…" : "Save message"}
          </Button>
          {saveMessage.isSuccess && (
            <span className="text-sm text-muted-foreground">Saved and published.</span>
          )}
        </div>
      </div>

      <div className="border-t pt-8 space-y-4">
        <div>
          <h2 className="text-base font-semibold">Recruitment Process Steps</h2>
          <p className="text-sm text-muted-foreground">
            These steps appear on the public recruitment page.
          </p>
        </div>

        <form onSubmit={handleSubmit((d) => save.mutate(d))} className="space-y-4">
          <ol className="space-y-3">
            {fields.map((field, i) => (
              <li key={field.id} className="flex gap-3 items-start rounded-lg border bg-white p-4">
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <div className="space-y-1 w-20 flex-shrink-0">
                      <Label className="text-xs">Number</Label>
                      <Input {...register(`steps.${i}.step_number`)} placeholder="e.g. 0" className="text-center" />
                    </div>
                    <div className="space-y-1 flex-1">
                      <Label className="text-xs">Title</Label>
                      <Input {...register(`steps.${i}.title`, { required: true })} placeholder="Step title" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Description</Label>
                    <Textarea {...register(`steps.${i}.desc`)} placeholder="Brief description (optional)" rows={4} className="resize-y" />
                  </div>
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <Button type="button" variant="ghost" size="sm" onClick={() => move(i, i - 1)} disabled={i === 0} className="h-7 w-7 p-0">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => move(i, i + 1)} disabled={i === fields.length - 1} className="h-7 w-7 p-0">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)} className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ol>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ title: "", desc: "" })}
          >
            <Plus className="h-4 w-4 mr-1" /> Add step
          </Button>

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save steps"}
            </Button>
            {save.isSuccess && (
              <span className="text-sm text-muted-foreground">Saved and published.</span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
