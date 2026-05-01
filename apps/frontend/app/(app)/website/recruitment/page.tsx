"use client";

import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createApi } from "@/lib/api";
import type { RecruitmentStep } from "@cba/types";

type FormValues = { steps: RecruitmentStep[] };

export default function RecruitmentStepsPage() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const api = () => createApi(session?.accessToken);

  const { data: steps = [] } = useQuery<RecruitmentStep[]>({
    queryKey: ["recruitment-steps"],
    queryFn: () => api().get("/ops/v1/settings/recruitment-steps"),
    enabled: !!session?.accessToken,
  });

  const { register, control, handleSubmit, reset } = useForm<FormValues>({
    values: { steps },
  });

  const { fields, append, remove, move } = useFieldArray({ control, name: "steps" });

  const save = useMutation({
    mutationFn: (data: FormValues) =>
      api().put("/ops/v1/settings/recruitment-steps", data.steps),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recruitment-steps"] }),
  });

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Recruitment Process</h1>
        <p className="text-sm text-muted-foreground">
          These steps appear on the public recruitment page.
        </p>
      </div>

      <form onSubmit={handleSubmit((d) => save.mutate(d))} className="space-y-4">
        <ol className="space-y-3">
          {fields.map((field, i) => (
            <li key={field.id} className="flex gap-3 items-start rounded-lg border bg-white p-4">
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-cba-green text-xs font-bold text-white mt-1">
                {i + 1}
              </span>
              <div className="flex-1 space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs">Title</Label>
                  <Input {...register(`steps.${i}.title`, { required: true })} placeholder="Step title" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Description</Label>
                  <Input {...register(`steps.${i}.desc`, { required: true })} placeholder="Brief description" />
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
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
          {save.isSuccess && (
            <span className="text-sm text-muted-foreground">Saved and published.</span>
          )}
        </div>
      </form>
    </div>
  );
}
