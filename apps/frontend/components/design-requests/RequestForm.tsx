"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppSession } from "@/hooks/session-context";
import { createApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ImageIcon, Type, ImagePlus } from "lucide-react";

type Mode = "text" | "image" | "new-image";

const FOLDER_LABELS: Record<string, string> = {
  "":            "General",
  "front":       "Homepage pillars",
  "logos":       "Company & school logos",
  "recruitment": "Recruitment page",
};

const SAFE_PATH_RE = /^[\w\-./]+\.(png|jpg|jpeg|gif|webp|avif|svg)$/i;

function folderLabel(folder: string): string {
  return FOLDER_LABELS[folder] ?? folder.replace(/[-_]/g, " ");
}

function fileLabel(filename: string): string {
  return filename.replace(/[-_]/g, " ").replace(/\.[^.]+$/, "");
}

function groupImages(paths: string[]): [string, { path: string; label: string }[]][] {
  const groups = new Map<string, { path: string; label: string }[]>();
  for (const path of paths) {
    const slash = path.lastIndexOf("/");
    const folder = slash === -1 ? "" : path.slice(0, slash);
    const filename = slash === -1 ? path : path.slice(slash + 1);
    if (!groups.has(folder)) groups.set(folder, []);
    groups.get(folder)!.push({ path, label: fileLabel(filename) });
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
}

export function RequestForm() {
  const session = useAppSession();
  const qc = useQueryClient();
  const api = () => createApi(session?.accessToken);

  const [mode, setMode] = useState<Mode>("text");
  const [description, setDescription] = useState("");
  const [targetPath, setTargetPath] = useState("");
  const [customPath, setCustomPath] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: websiteImages = [], isLoading: imagesLoading, isError: imagesError } = useQuery<string[]>({
    queryKey: ["website-images"],
    queryFn: () => api().get("/ops/v1/design-requests/website-images"),
    enabled: !!session?.accessToken && mode === "image",
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  function resetForm() {
    setDescription("");
    setTargetPath("");
    setCustomPath("");
    setAttachmentUrl(null);
    setUploadError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const submit = useMutation({
    mutationFn: () => {
      let desc = description;
      let attachment: string | null = null;
      let path: string | null = null;

      if (mode === "image") {
        desc = `Image swap: replace ${targetPath} with the attached image.${description ? " " + description : ""}`;
        attachment = attachmentUrl;
        path = targetPath;
      } else if (mode === "new-image") {
        desc = `New image uploaded to ${customPath}. ${description}`.trim();
        attachment = attachmentUrl;
        path = customPath;
      }

      return api().post("/ops/v1/design-requests", {
        description: desc,
        attachment_url: attachment,
        target_path: path,
      });
    },
    onSuccess: () => {
      resetForm();
      qc.invalidateQueries({ queryKey: ["design-requests"] });
    },
  });

  const submitError = submit.error instanceof Error ? submit.error.message : null;

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

  const customPathValid = SAFE_PATH_RE.test(customPath.trim());

  const canSubmit =
    mode === "text"
      ? !!description.trim()
      : mode === "image"
        ? !!targetPath && !!attachmentUrl
        : !!customPath.trim() && customPathValid && !!attachmentUrl && !!description.trim();

  const tabs = [
    ["text", "Text change", Type],
    ["image", "Image swap", ImageIcon],
    ["new-image", "New image", ImagePlus],
  ] as const;

  return (
    <div className="rounded-lg border bg-white overflow-hidden">
      {/* Mode tabs */}
      <div className="flex border-b">
        {tabs.map(([m, label, Icon]) => (
          <button
            key={m}
            onClick={() => { setMode(m); resetForm(); }}
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
        {mode === "text" && (
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
        )}

        {mode === "image" && (
          <>
            <p className="text-xs text-muted-foreground">
              Pick which image to replace, upload your new version, and optionally add a note. A director will
              review it before anything changes.
            </p>

            <div className="space-y-1">
              <label className="text-xs font-medium">Image to replace</label>
              {imagesError ? (
                <p className="text-xs text-destructive">
                  Could not load image list — ask a director to configure{" "}
                  <code className="font-mono">GITHUB_TOKEN</code> in Railway.
                </p>
              ) : (
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                  value={targetPath}
                  onChange={(e) => setTargetPath(e.target.value)}
                  disabled={submit.isPending || imagesLoading}
                >
                  <option value="">{imagesLoading ? "Loading images…" : "Select an image…"}</option>
                  {groupImages(websiteImages).map(([folder, items]) => (
                    <optgroup key={folder} label={folderLabel(folder)}>
                      {items.map(({ path, label }) => (
                        <option key={path} value={path}>{label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Replacement image</label>
              <div className="flex items-center gap-2">
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading || submit.isPending}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? "Uploading…" : "Choose file"}
                </Button>
                {attachmentUrl && <span className="text-xs text-emerald-600 font-medium">Uploaded</span>}
                {uploadError && <span className="text-xs text-destructive">{uploadError}</span>}
              </div>
            </div>

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

        {mode === "new-image" && (
          <>
            <p className="text-xs text-muted-foreground">
              Upload a brand-new image and describe where it should appear on the site. The agent will
              write the code to display it in the right place.
            </p>

            <div className="space-y-1">
              <label className="text-xs font-medium">Image file</label>
              <div className="flex items-center gap-2">
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading || submit.isPending}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? "Uploading…" : "Choose file"}
                </Button>
                {attachmentUrl && <span className="text-xs text-emerald-600 font-medium">Uploaded</span>}
                {uploadError && <span className="text-xs text-destructive">{uploadError}</span>}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Destination path</label>
              <input
                type="text"
                placeholder="e.g. team/john-smith.jpg or logos/new-partner.png"
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
                disabled={submit.isPending}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 font-mono"
              />
              {customPath && !customPathValid && (
                <p className="text-xs text-destructive">
                  Must be a relative path ending in .png, .jpg, .jpeg, .gif, .webp, .avif, or .svg
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Path inside <code className="font-mono">apps/website/public/</code> — use subfolders like{" "}
                <code className="font-mono">team/</code> or <code className="font-mono">logos/</code>
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Where and how to use it</label>
              <Textarea
                rows={3}
                placeholder="e.g. Add this as John Smith's headshot in the Team section, below the existing members"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={submit.isPending}
              />
            </div>
          </>
        )}

        <div className="flex items-center justify-end gap-3">
          {submitError && <p className="text-xs text-destructive">{submitError}</p>}
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
