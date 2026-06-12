"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, MapPin } from "lucide-react";
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

function formatEventDate(iso: string) {
  const d = new Date(iso);
  return {
    month: d.toLocaleString("en-US", { month: "short" }).toUpperCase(),
    day: d.getDate(),
    weekday: d.toLocaleString("en-US", { weekday: "short" }),
    time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
  };
}

function EventRow({
  event,
  onEdit,
  onDelete,
}: {
  event: Event;
  onEdit: (e: Event) => void;
  onDelete: (id: string) => void;
}) {
  const { month, day, weekday, time } = formatEventDate(event.eventDate);
  return (
    <div className="flex items-start gap-4 px-5 py-4 hover:bg-muted/30 transition-colors group">
      {/* Date stamp */}
      <div className="w-12 shrink-0 text-center">
        <p className="text-[10px] font-semibold tracking-widest text-muted-foreground leading-none">
          {month}
        </p>
        <p className="text-2xl font-bold tabular-nums leading-tight">{day}</p>
        <p className="text-[10px] text-muted-foreground">{weekday}</p>
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className="font-medium leading-snug">{event.title}</p>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span>{time}</span>
          {event.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {event.location}
            </span>
          )}
        </div>
      </div>

      {/* Badges + actions */}
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant="secondary" className="capitalize text-xs">
          {event.type}
        </Badge>
        <Badge variant={event.isPublished ? "success" : "outline"} className="text-xs">
          {event.isPublished ? "Published" : "Draft"}
        </Badge>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(event)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => confirm("Delete this event?") && onDelete(event.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function EventGroup({
  label,
  events,
  onEdit,
  onDelete,
}: {
  label: string;
  events: Event[];
  onEdit: (e: Event) => void;
  onDelete: (id: string) => void;
}) {
  if (events.length === 0) return null;
  return (
    <div>
      <p className="px-5 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide bg-muted/40 border-b">
        {label} · {events.length}
      </p>
      <div className="divide-y">
        {events.map((e) => (
          <EventRow key={e.id} event={e} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}

export default function EventsPage() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const api = () => createApi(session?.accessToken);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);
  const { register, handleSubmit, setValue, reset } = useForm<EventForm>();

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      setOpen(false);
      reset();
      setEditing(null);
    },
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

  const now = new Date();
  const upcoming = events
    .filter((e) => new Date(e.eventDate) >= now)
    .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
  const past = events
    .filter((e) => new Date(e.eventDate) < now)
    .sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime());

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
          {!isLoading && upcoming.length > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {upcoming.length} upcoming
            </p>
          )}
        </div>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) {
              reset();
              setEditing(null);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              New event
            </Button>
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
                    <SelectTrigger>
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {EVENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
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
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Event list */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No events yet.</p>
      ) : (
        <div className="rounded-lg border bg-white overflow-hidden">
          <EventGroup
            label="Upcoming"
            events={upcoming}
            onEdit={openEdit}
            onDelete={(id) => remove.mutate(id)}
          />
          {upcoming.length === 0 && (
            <p className="px-5 py-4 text-sm text-muted-foreground">No upcoming events.</p>
          )}
          <EventGroup
            label="Past"
            events={past}
            onEdit={openEdit}
            onDelete={(id) => remove.mutate(id)}
          />
        </div>
      )}
    </div>
  );
}
