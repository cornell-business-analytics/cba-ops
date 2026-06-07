"use client";

import { useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createApi } from "@/lib/api";

type Block = { type: string; id: string; [key: string]: unknown };

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

function ImageUploadField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const { data: session } = useSession();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const api = () => createApi(session?.accessToken);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { uploadUrl, publicUrl } = await api().post<{ uploadUrl: string; publicUrl: string; key: string }>(
        "/ops/v1/assets/upload",
        { filename: file.name, content_type: file.type },
      );
      await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      onChange(publicUrl);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://…"
          className="flex-1"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1 rounded-md border border-input px-3 py-2 text-sm hover:bg-muted disabled:opacity-60 whitespace-nowrap"
        >
          <Upload className="h-4 w-4" />
          {uploading ? "Uploading…" : "Upload"}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
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
          <ImageUploadField
            label="Background Image"
            value={str(block.image_url)}
            onChange={(v) => set("image_url", v)}
          />
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
