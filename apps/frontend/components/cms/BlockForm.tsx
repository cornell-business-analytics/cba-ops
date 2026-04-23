"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Block = { type: string; [key: string]: unknown };

interface Props {
  block: Block;
  onChange: (updated: Block) => void;
}

function Field({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export function BlockForm({ block, onChange }: Props) {
  const set = (key: string, value: unknown) => onChange({ ...block, [key]: value });

  switch (block.type) {
    case "hero":
      return (
        <div className="space-y-3">
          <Field label="Heading" value={str(block.heading)} onChange={(v) => set("heading", v)} />
          <Field label="Subheading" value={str(block.subheading)} onChange={(v) => set("subheading", v)} />
          <Field label="CTA Label" value={str(block.cta_label)} onChange={(v) => set("cta_label", v)} />
          <Field label="CTA URL" value={str(block.cta_url)} onChange={(v) => set("cta_url", v)} />
          <Field label="Background Image URL" value={str(block.image_url)} onChange={(v) => set("image_url", v)} />
        </div>
      );

    case "rich_text":
      return (
        <Field label="Content (Markdown)" value={str(block.content)} onChange={(v) => set("content", v)} multiline />
      );

    case "cta":
      return (
        <div className="space-y-3">
          <Field label="Heading" value={str(block.heading)} onChange={(v) => set("heading", v)} />
          <Field label="Body" value={str(block.body)} onChange={(v) => set("body", v)} multiline />
          <Field label="Button Label" value={str(block.button_label)} onChange={(v) => set("button_label", v)} />
          <Field label="Button URL" value={str(block.button_url)} onChange={(v) => set("button_url", v)} />
        </div>
      );

    case "team_list":
      return (
        <p className="text-sm text-muted-foreground">
          Team list pulls active members automatically. No configuration needed.
        </p>
      );

    case "event_list":
      return (
        <p className="text-sm text-muted-foreground">
          Event list pulls published events automatically.
        </p>
      );

    case "project_list":
      return (
        <p className="text-sm text-muted-foreground">
          Project list pulls current projects automatically.
        </p>
      );

    case "faq":
      return (
        <div className="space-y-3">
          <Field label="Section Title" value={str(block.title)} onChange={(v) => set("title", v)} />
          <p className="text-xs text-muted-foreground">
            FAQ items are edited individually — more editing controls coming soon.
          </p>
        </div>
      );

    default:
      return (
        <p className="text-sm text-muted-foreground">
          Unknown block type: <code>{block.type}</code>
        </p>
      );
  }
}
