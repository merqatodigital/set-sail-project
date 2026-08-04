import { useRef, useState } from "react";
import { Plus, Trash2, UploadCloud, Film, ExternalLink } from "lucide-react";
import { useCms } from "@/context/CmsContext";
import { useToast } from "@/context/ToastContext";
import { supabase } from "@/lib/supabase";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import { PageHeader, EmptyState } from "../shared/PageHeader";
import { SortableList } from "../shared/SortableList";
import { getEmbedUrl, detectVideoType } from "@/lib/videoUtils";
import type { VideoItem } from "@/types/cms";

const SECTIONS = [
  { value: "hero", label: "Hero (Homepage Top)" },
  { value: "workspace", label: "Workspace Section" },
  { value: "kitchen", label: "Kitchen Section" },
  { value: "stay", label: "Stay / Accommodation" },
  { value: "facilities", label: "Facilities Section" },
  { value: "pricing", label: "Pricing Section" },
  { value: "testimonials", label: "Testimonials / FAQ" },
  { value: "cta", label: "CTA / Footer Area" },
] as const;

const POSITIONS = [
  { value: "top", label: "Top" },
  { value: "middle", label: "Middle" },
  { value: "bottom", label: "Bottom" },
] as const;

const BUCKET = "videos";

async function uploadToSupabase(file: File): Promise<string | null> {
  if (!supabase) return null;
  const ext = file.name.split(".").pop() || "mp4";
  const path = `site-videos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    console.error("[VideoManager] Upload failed:", error);
    return null;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data?.publicUrl ?? null;
}

export default function VideoManager() {
  const { data, update } = useCms();
  const { notify } = useToast();
  const items = [...data.videos].sort((a, b) => a.order - b.order);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pasteUrl, setPasteUrl] = useState("");

  const setAll = (next: VideoItem[]) => update((d) => ({ ...d, videos: next }));

  const addFromUrl = () => {
    if (!pasteUrl.trim()) return;
    const type = detectVideoType(pasteUrl);
    if (type === "upload") {
      notify("Please use the upload button for video files", "error");
      return;
    }
    setAll([
      ...items,
      {
        id: `vid_${Date.now()}`,
        title: "Untitled Video",
        type,
        url: pasteUrl.trim(),
        section: "hero",
        position: "middle",
        order: items.length,
      },
    ]);
    setPasteUrl("");
    notify("Video added");
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      if (file.size > 100 * 1024 * 1024) {
        notify(`${file.name} is too large (max 100MB)`, "error");
        continue;
      }

      const url = await uploadToSupabase(file);
      if (!url) {
        notify(`Failed to upload ${file.name}`, "error");
        continue;
      }

      setAll([
        ...items,
        {
          id: `vid_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          title: file.name.replace(/\.[^.]+$/, ""),
          type: "upload",
          url,
          section: "hero",
          position: "middle",
          order: items.length,
        },
      ]);
    }

    setUploading(false);
    notify("Video uploaded");
  };

  const updateItem = (id: string, patch: Partial<VideoItem>) => {
    setAll(items.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  };

  return (
    <div>
      <PageHeader
        title="Video Manager"
        description="Upload video files or paste YouTube/Vimeo links. Choose where each video appears on the site."
      />

      <Card className="mb-6 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Paste YouTube or Vimeo URL" hint="e.g. https://www.youtube.com/watch?v=...">
            <Input value={pasteUrl} onChange={(e) => setPasteUrl(e.target.value)} placeholder="https://youtube.com/watch?v=…" />
          </Field>
          <Button onClick={addFromUrl}><Plus className="h-4 w-4" /> Add Video</Button>
        </div>
        <div className="mt-4 flex items-center gap-3 border-t border-[#26221C]/10 pt-4">
          <input ref={fileRef} type="file" accept="video/*" multiple hidden onChange={(e) => handleUpload(e.target.files)} />
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <UploadCloud className="h-4 w-4" /> {uploading ? "Uploading…" : "Upload Video File"}
          </Button>
          <span className="text-xs text-[#26221C]/40">Max 100MB per file</span>
        </div>
      </Card>

      {items.length === 0 ? (
        <EmptyState title="No videos yet" description="Add a YouTube link, Vimeo link, or upload a video file. Then choose where it appears on your site." />
      ) : (
        <SortableList
          items={items}
          onChange={(next) => setAll(next.map((it, idx) => ({ ...it, order: idx })))}
          renderItem={(video, handle) => (
            <Card className="p-4">
              <div className="flex items-start gap-3">
                {handle}
                <div className="w-32 shrink-0 overflow-hidden rounded-lg bg-black/90">
                  {video.type === "upload" ? (
                    <video src={video.url} className="aspect-video w-full object-cover" muted />
                  ) : (
                    <div className="flex aspect-video w-full items-center justify-center text-white/40">
                      <Film className="h-6 w-6" />
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <Input
                    value={video.title}
                    onChange={(e) => updateItem(video.id, { title: e.target.value })}
                    placeholder="Video title"
                  />
                  <p className="truncate text-xs text-[#26221C]/45">{video.type.toUpperCase()} · {video.url.slice(0, 60)}…</p>
                  <div className="flex gap-2">
                    <Select
                      value={video.section || "hero"}
                      onChange={(e) => updateItem(video.id, { section: e.target.value })}
                      className="w-40 text-xs"
                    >
                      {SECTIONS.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </Select>
                    <Select
                      value={video.position || "middle"}
                      onChange={(e) => updateItem(video.id, { position: e.target.value })}
                      className="w-28 text-xs"
                    >
                      {POSITIONS.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  {video.type !== "upload" && (
                    <a href={video.url} target="_blank" rel="noreferrer" className="rounded p-1 text-[#26221C]/30 hover:text-blue-500">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <button onClick={() => setAll(items.filter((v) => v.id !== video.id))} className="rounded p-1 text-[#26221C]/30 hover:text-red-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </Card>
          )}
        />
      )}

      {items.length > 0 && (
        <div className="mt-10">
          <h3 className="mb-4 font-serif text-lg text-[#26221C]">Live Preview</h3>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {items.map((v) => (
              <div key={v.id} className="overflow-hidden rounded-xl border border-[#26221C]/10 bg-black">
                {v.type === "upload" ? (
                  <video src={v.url} controls className="aspect-video w-full" />
                ) : (
                  <iframe
                    src={getEmbedUrl(v.type, v.url)}
                    className="aspect-video w-full"
                    title={v.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                )}
                <div className="px-3 py-2 text-xs text-white/50">
                  {SECTIONS.find((s) => s.value === v.section)?.label || v.section} · {v.position || "middle"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
