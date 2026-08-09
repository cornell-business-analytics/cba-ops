"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppSession } from "@/hooks/session-context";
import { createApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ImageIcon, Type } from "lucide-react";

type Mode = "text" | "image";

function friendlyLabel(path: string): string {
  const name = path.split("/").pop() ?? path;
  return name.replace(/[-_]/g, " ").replace(/\.[^.]+$/, "");
}

export function RequestForm() {
  const session = useAppSession();
  const qc = useQueryClient();
  const api = () => createApi(session?.accessToken);

  const [mode, setMode] = useState<Mode>("text");
  const [description, setDescription] = useState("");
  const [targetPath, setTargetPath] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: websiteImages = [] } = useQuery<string[]>({
    queryKey: ["website-images"],
    queryFn: () => api().get("/ops/v1/design-requests/website-images"),
    enabled: !!session?.accessToken && mode === "image",
    staleTime: 5 * 60 * 1000,
  });

  const submit = useMutation({
    mutationFn: () =>
      api().post("/ops/v1/design-requests", {
        description: mode === "image"
          ? `Image swap: replace ${targetPath} with the attached image.${description ? " " + description : ""}`
          : description,
        attachment_url: mode === "image" ? attachmentUrl : null,
        target_path: mode === "image" ? targetPath : null,
      }),
    onSuccess: () => {
      setDescription("");
      setTargetPath("");
      setAttachmentUrl(null);
      setUploadError(null);
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["design-requests"] });
    },
  });

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    setAttachmentUrl(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await createApi(session?.accessToken).postForm("/ops/v1/assets/upload", formData);
      setAttachmentUrl((result as { public_url: string }).public_url);
    } catch {
      setUploadError("Upload failed — try again.");
    } finally {
      setUploading(false);
    }
  }

  const canSubmit = mode === "text"
    ? !!description.trim()
    : !!targetPath && !!attachmentUrl;

  return (
    <div className="rounded-lg border bg-white overflow-hidden">
      {/* Mode tabs */}
      <div className="flex border-b">
        {([["text", "Text change", Type], ["image", "Image swap", ImageIcon]] as const).map(([m, label, Icon]) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm transition-colors ${
              mode === m
                ? "border-b-2 border-foreground font-medium text-foreground -mb-px"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-3">
        {mode === "text" ? (
          <>
            <p className="text-xs text-muted-foreground">
              Describe what you&apos;d like changed on the public site. A director will review it, then
              an AI agent will make the change and open a PR for preview before anything goes live.
            </p>
            <Textarea
              rows={3}
              placeholder="e.g. Make the hero section background a darker green"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submit.isPending}
            />
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Pick which image to replace, upload your new version, and optionally add a note. A director will
              review it before anything changes.
            </p>

            {/* Image picker */}
            <div className="space-y-1">
              <label className="text-xs font-medium">Image to replace</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={targetPath}
                onChange={(e) => setTargetPath(e.target.value)}
                disabled={submit.isPending}
              >
                <option value="">Select an image…</option>
                {websiteImages.map((path) => (
                  <option key={path} value={path}>
                    {friendlyLabel(path)} ({path})
                  </option>
                ))}
              </select>
            </div>

            {/* File upload */}
            <div className="space-y-1">
              <label className="text-xs font-medium">Replacement image</label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFile}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading || submit.isPending}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? "Uploading…" : "Choose file"}
                </Button>
                {attachmentUrl && (
                  <span className="text-xs text-emerald-600 font-medium">Uploaded</span>
                )}
                {uploadError && (
                  <span className="text-xs text-destructive">{uploadError}</span>
                )}
              </div>
            </div>

            {/* Optional note */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Note (optional)</label>
              <Textarea
                rows={2}
                placeholder="e.g. Updated group photo from Spring 2026 retreat"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={submit.isPending}
              />
            </div>
          </>
        )}

        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={!canSubmit || submit.isPending || uploading}
            onClick={() => submit.mutate()}
          >
            {submit.isPending ? "Submitting…" : "Submit request"}
          </Button>
        </div>
      </div>
    </div>
  );
}
