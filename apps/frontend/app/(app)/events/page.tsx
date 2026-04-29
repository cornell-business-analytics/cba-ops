"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createApi } from "@/lib/api";
import type { Event } from "@cba/types";

type EventForm = {
  title: string;
  slug: string;
  description: string;
  location: string;
  event_date: string;
  type: string;
  is_published: boolean;
};

const EVENT_TYPES = ["recruitment", "workshop", "speaker", "social", "other"];

export default function EventsPage() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const api = () => createApi(session?.accessToken);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);
  const { register, handleSubmit, setValue, reset, watch } = useForm<EventForm>();

  const { data: events = [], isLoading } = useQuery<Event[]>({
    queryKey: ["events"],
    queryFn: () => api().get("/ops/v1/events"),
    enabled: !!session?.accessToken,
  });

  const save = useMutation({
    mutationFn: (data: EventForm) =>
      editing
        ? api().patch(`/ops/v1/events/${editing.id}`, data)
        : api().post("/ops/v1/events", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["events"] }); setOpen(false); reset(); setEditing(null); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api().delete(`/ops/v1/events/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["events"] }),
  });

  function openEdit(event: Event) {
    setEditing(event);
    reset({
      title: event.title,
      slug: event.slug,
      description: event.description ?? "",
      location: event.location ?? "",
      event_date: event.eventDate.slice(0, 16),
      type: event.type,
      is_published: event.isPublished,
    });
    setOpen(true);
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Events</h1>
          <p className="text-sm text-muted-foreground">{events.length} total</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { reset(); setEditing(null); } }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />New event</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit event" : "New event"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit((d) => save.mutate(d))} className="space-y-3 mt-2">
              <div className="space-y-1">
                <Label>Title</Label>
                <Input {...register("title", { required: true })} placeholder="Spring Info Session" />
              </div>
              <div className="space-y-1">
                <Label>Slug</Label>
                <Input {...register("slug", { required: true })} placeholder="spring-info-session" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Date & Time</Label>
                  <Input type="datetime-local" {...register("event_date", { required: true })} />
                </div>
                <div className="space-y-1">
                  <Label>Type</Label>
                  <Select onValueChange={(v) => setValue("type", v)} defaultValue={editing?.type}>
                    <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                    <SelectContent>
                      {EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Location</Label>
                <Input {...register("location")} placeholder="Klarman Hall 120" />
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <textarea
                  {...register("description")}
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Event description…"
                />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="published" {...register("is_published")} />
                <Label htmlFor="published">Published</Label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? "Saving…" : "Save"}
                </Button>
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
                {["Title", "Date", "Type", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {events.map((event) => (
                <tr key={event.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{event.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(event.eventDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">{event.type}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={event.isPublished ? "success" : "outline"}>
                      {event.isPublished ? "Published" : "Draft"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(event)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => confirm("Delete this event?") && remove.mutate(event.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
