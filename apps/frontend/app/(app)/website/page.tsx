"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createApi } from "@/lib/api";
import type { Page } from "@cba/types";

type NewPageForm = { slug: string; title: string };

const STATUS_VARIANT: Record<string, "outline" | "warning" | "success"> = {
  draft: "outline",
  review: "warning",
  published: "success",
};

export default function WebsitePage() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const api = () => createApi(session?.accessToken);
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, reset } = useForm<NewPageForm>();

  const { data: pages = [], isLoading } = useQuery<Page[]>({
    queryKey: ["pages"],
    queryFn: () => api().get("/ops/v1/pages"),
    enabled: !!session?.accessToken,
  });

  const create = useMutation({
    mutationFn: (data: NewPageForm) => api().post("/ops/v1/pages", { ...data, blocks: [] }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pages"] }); setOpen(false); reset(); },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="rounded-lg border bg-white p-4 flex items-center justify-between">
        <div>
          <p className="font-medium text-sm">Recruitment process steps</p>
          <p className="text-xs text-muted-foreground mt-0.5">Edit the steps shown on the public recruitment page.</p>
        </div>
        <Link href="/website/recruitment" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
          Edit →
        </Link>
      </div>

      <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Website Pages</h1>
          <p className="text-sm text-muted-foreground">{pages.length} pages</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />New page</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New page</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit((d) => create.mutate(d))} className="space-y-3 mt-2">
              <div className="space-y-1">
                <Label>Title</Label>
                <Input {...register("title", { required: true })} placeholder="About Us" />
              </div>
              <div className="space-y-1">
                <Label>Slug</Label>
                <Input {...register("slug", { required: true })} placeholder="about" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={create.isPending}>Create</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border bg-white overflow-hidden">
        {isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {["Title", "Slug", "Status", "Last Updated", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {pages.map((page) => (
                <tr key={page.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{page.title}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">/{page.slug}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[page.status] ?? "outline"}>
                      {page.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(page.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/website/${page.slug}`}
                      className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                    >
                      Edit →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      </div>
    </div>
  );
}
