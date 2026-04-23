"use client";

import { useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, GripVertical, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BlockForm } from "@/components/cms/BlockForm";
import { PublishButton } from "@/components/cms/PublishButton";
import { createApi } from "@/lib/api";
import type { Page } from "@cba/types";

type Block = { type: string; id: string; [key: string]: unknown };

const BLOCK_TYPES = [
  { type: "hero", label: "Hero" },
  { type: "rich_text", label: "Rich Text" },
  { type: "cta", label: "Call to Action" },
  { type: "team_list", label: "Team List" },
  { type: "event_list", label: "Event List" },
  { type: "faq", label: "FAQ" },
];

function defaultBlock(type: string): Block {
  const id = crypto.randomUUID();
  switch (type) {
    case "hero": return { id, type, heading: "", subheading: "", cta_label: "", cta_url: "" };
    case "rich_text": return { id, type, content: "" };
    case "cta": return { id, type, heading: "", body: "", button_label: "", button_url: "" };
    default: return { id, type };
  }
}

function SortableBlock({
  block,
  onChange,
  onRemove,
}: {
  block: Block;
  onChange: (b: Block) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border bg-white">
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <button {...listeners} {...attributes} className="cursor-grab text-muted-foreground hover:text-foreground">
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="flex-1 text-sm font-medium capitalize">{block.type.replace("_", " ")}</span>
        <button onClick={() => setExpanded((e) => !e)} className="text-muted-foreground hover:text-foreground">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        <button onClick={onRemove} className="text-muted-foreground hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {expanded && (
        <div className="p-4">
          <BlockForm block={block} onChange={onChange} />
        </div>
      )}
    </div>
  );
}

export default function PageEditorPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: session } = useSession();
  const qc = useQueryClient();
  const router = useRouter();
  const api = () => createApi(session?.accessToken);

  const sensors = useSensors(useSensor(PointerSensor));
  const [showBlockPicker, setShowBlockPicker] = useState(false);
  const [dirty, setDirty] = useState(false);

  const { data: page, isLoading } = useQuery<Page>({
    queryKey: ["page", slug],
    queryFn: () => api().get(`/ops/v1/pages/${slug}`),
    enabled: !!session?.accessToken,
  });

  const [blocks, setBlocks] = useState<Block[]>([]);

  // Sync blocks from server on first load
  const initialized = blocks.length > 0 || (page && (page.blocks as Block[]).length === 0);
  if (page && !initialized) {
    setBlocks(
      (page.blocks as Block[]).map((b, i) => ({
        ...b,
        id: (b.id as string) ?? String(i),
      })),
    );
  }

  const save = useMutation({
    mutationFn: () => api().patch(`/ops/v1/pages/${slug}`, { blocks }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["page", slug] }); setDirty(false); },
  });

  const updateBlock = useCallback(
    (id: string, updated: Block) => {
      setBlocks((prev) => prev.map((b) => (b.id === id ? updated : b)));
      setDirty(true);
    },
    [],
  );

  const removeBlock = useCallback((id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    setDirty(true);
  }, []);

  const addBlock = (type: string) => {
    setBlocks((prev) => [...prev, defaultBlock(type)]);
    setShowBlockPicker(false);
    setDirty(true);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setBlocks((prev) => {
        const oldIndex = prev.findIndex((b) => b.id === active.id);
        const newIndex = prev.findIndex((b) => b.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
      setDirty(true);
    }
  };

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!page) return <div className="p-6 text-sm text-muted-foreground">Page not found.</div>;

  return (
    <div className="p-6 max-w-2xl space-y-4">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Pages
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{page.title}</h1>
          <p className="text-sm font-mono text-muted-foreground">/{slug}</p>
        </div>
        <div className="flex items-center gap-2">
          <PublishButton slug={slug} status={page.status} />
          <Button size="sm" onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {/* Block list */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {blocks.map((block) => (
              <SortableBlock
                key={block.id}
                block={block}
                onChange={(updated) => updateBlock(block.id, updated)}
                onRemove={() => removeBlock(block.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add block */}
      <div className="relative">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setShowBlockPicker((v) => !v)}
        >
          <Plus className="h-4 w-4 mr-1" /> Add block
        </Button>
        {showBlockPicker && (
          <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border bg-white shadow-md z-10 p-2 grid grid-cols-2 gap-1">
            {BLOCK_TYPES.map(({ type, label }) => (
              <button
                key={type}
                onClick={() => addBlock(type)}
                className="rounded-md px-3 py-2 text-sm text-left hover:bg-muted transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
