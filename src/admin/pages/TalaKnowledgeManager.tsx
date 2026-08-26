import { useRef, useState } from "react";
import { Download, FileText, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { Button, Card, Field, Input, Switch, Modal, Textarea } from "@/components/ui";
import { PageHeader } from "../shared/PageHeader";
import { supabase, isSupabaseConnected } from "@/lib/supabase";
import { useTalaKnowledge } from "@/components/tala/useTalaKnowledge";
import {
  stripPrices,
  parseKnowledgeCsv,
  toKnowledgeCsv,
  knowledgeCsvTemplate,
  downloadTextFile,
  type TalaKnowledgeEntry,
} from "@/components/tala/talaKnowledge";

// ---------------------------------------------------------------------------
// TALA's knowledge base — free-form facts (hours, policies, local info) an
// admin maintains directly, separate from the structured Rooms/Pricing data
// that already feeds her prompt. Prices are automatically stripped before
// any entry reaches the model, so a stale number here can never contradict
// the real pricing pages.
// ---------------------------------------------------------------------------

type DraftEntry = Omit<TalaKnowledgeEntry, "id"> & { id?: string };

const EMPTY_DRAFT: DraftEntry = {
  topic: "",
  label: "",
  body: "",
  tags: "",
  enabled: true,
  sort_order: 0,
};

export default function TalaKnowledgeManager() {
  const { notify } = useToast();
  const knowledge = useTalaKnowledge();
  const [editing, setEditing] = useState<DraftEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadSummary, setUploadSummary] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openNew = () => setEditing({ ...EMPTY_DRAFT, sort_order: knowledge.entries.length * 10 });
  const openEdit = (entry: TalaKnowledgeEntry) => setEditing({ ...entry });

  const saveDraft = async () => {
    if (!editing || !editing.topic.trim() || !editing.label.trim()) {
      notify("Topic and label are required", "info");
      return;
    }
    if (!isSupabaseConnected() || !supabase) {
      notify("Knowledge base isn't connected right now", "info");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        topic: editing.topic.trim(),
        label: editing.label.trim(),
        body: editing.body.trim(),
        tags: editing.tags.trim(),
        enabled: editing.enabled,
        sort_order: editing.sort_order,
        updated_at: new Date().toISOString(),
      };
      if (editing.id) {
        const { error } = await supabase
          .from("tala_knowledge")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tala_knowledge").insert(payload);
        if (error) throw error;
      }
      notify("Entry saved — live immediately");
      setEditing(null);
      void knowledge.refresh();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Couldn't save that entry", "info");
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = async (id: string) => {
    if (!isSupabaseConnected() || !supabase) return;
    try {
      const { error } = await supabase.from("tala_knowledge").delete().eq("id", id);
      if (error) throw error;
      notify("Entry deleted");
      void knowledge.refresh();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Couldn't delete that entry", "info");
    }
  };

  const toggleEnabled = async (entry: TalaKnowledgeEntry) => {
    if (!isSupabaseConnected() || !supabase) return;
    try {
      const { error } = await supabase
        .from("tala_knowledge")
        .update({ enabled: !entry.enabled, updated_at: new Date().toISOString() })
        .eq("id", entry.id);
      if (error) throw error;
      void knowledge.refresh();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Couldn't update that entry", "info");
    }
  };

  const downloadTemplate = () =>
    downloadTextFile("tala-knowledge-template.csv", knowledgeCsvTemplate());
  const downloadAll = () =>
    downloadTextFile("tala-knowledge-export.csv", toKnowledgeCsv(knowledge.entries));

  // ---- Quick Add — paste anything (a policy, a price list, directions,
  // local tips). Each paragraph separated by a blank line becomes one entry;
  // TALA knows it on her very next reply.
  const [quickText, setQuickText] = useState("");
  const [quickAdding, setQuickAdding] = useState(false);

  const slugify = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .trim()
      .split(/\s+/)
      .slice(0, 4)
      .join("-") || "note";

  const labelFrom = (text: string) => {
    const firstSentence = text.split(/[.!?\n]/)[0]?.trim() || text.trim();
    const words = firstSentence.split(/\s+/).slice(0, 8).join(" ");
    return words.length > 60 ? `${words.slice(0, 57)}…` : words;
  };

  const quickAdd = async () => {
    const paragraphs = quickText
      .split(/\n\s*\n/)
      .map((p) => p.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    if (!paragraphs.length) {
      notify("Paste some text first", "info");
      return;
    }
    if (!isSupabaseConnected() || !supabase) {
      notify("Knowledge base isn't connected right now", "info");
      return;
    }
    setQuickAdding(true);
    try {
      const base = knowledge.entries.length * 10;
      const usedTopics = new Set(knowledge.entries.map((e) => e.topic));
      const rows = paragraphs.map((body, i) => {
        let topic = slugify(body);
        while (usedTopics.has(topic)) topic = `${topic}-${i + 1}`;
        usedTopics.add(topic);
        return {
          topic,
          label: labelFrom(body),
          body,
          tags: "",
          enabled: true,
          sort_order: base + i * 10,
        };
      });
      const { error } = await supabase.from("tala_knowledge").insert(rows);
      if (error) throw error;
      notify(`TALA learned ${rows.length} new ${rows.length === 1 ? "fact" : "facts"} — live now`);
      setQuickText("");
      void knowledge.refresh();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Couldn't save that", "info");
    } finally {
      setQuickAdding(false);
    }
  };

  const handleBulkUploadFile = async (file: File) => {
    const text = await file.text();
    const { rows, errors } = parseKnowledgeCsv(text);
    if (!rows.length) {
      setUploadSummary(errors.length ? errors.join(" ") : "No valid rows found in that file.");
      return;
    }
    if (!isSupabaseConnected() || !supabase) {
      setUploadSummary("Knowledge base isn't connected right now.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("tala_knowledge").insert(rows);
      if (error) throw error;
      setUploadSummary(
        `Imported ${rows.length} entr${rows.length === 1 ? "y" : "ies"}.` +
          (errors.length ? ` ${errors.length} row(s) skipped: ${errors.join(" ")}` : ""),
      );
      notify(`Imported ${rows.length} knowledge entries`);
      void knowledge.refresh();
    } catch (e) {
      setUploadSummary(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Knowledge Base"
        description="Everything the concierge knows about your property. Add, edit, or delete entries here — updates go live immediately. Bulk-download to back up, or bulk-upload a filled-in template. Prices are automatically stripped before the bot ever sees the text."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <FileText className="h-4 w-4" /> Template
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadAll}
              disabled={knowledge.entries.length === 0}
            >
              <Download className="h-4 w-4" /> Download All
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4" /> Bulk Upload
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleBulkUploadFile(file);
                e.target.value = "";
              }}
            />
            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4" /> Add Entry
            </Button>
          </>
        }
      />

      {uploadSummary && (
        <Card className="mb-6 border-[#C6A15B]/30 bg-[#FAF6EF] p-4 text-sm text-[#26221C]/80">
          {uploadSummary}
        </Card>
      )}

      <Card className="p-0">
        {knowledge.entries.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#26221C]/50">
            No knowledge entries yet. Click <strong>Add entry</strong> to create the first one, or
            download the template and bulk-upload.
          </div>
        ) : (
          <div className="divide-y divide-[#26221C]/8">
            {knowledge.entries.map((entry) => (
              <div key={entry.id} className="flex items-start gap-3 p-4">
                <Switch checked={entry.enabled} onChange={() => void toggleEnabled(entry)} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-serif text-base text-[#26221C]">{entry.label}</span>
                    <span className="text-xs text-[#26221C]/40">{entry.topic}</span>
                  </div>
                  <p className="mt-1 text-sm text-[#26221C]/70">{entry.body}</p>
                  {entry.tags && (
                    <p className="mt-1 text-xs text-[#26221C]/40">
                      {entry.tags
                        .split(";")
                        .map((t) => t.trim())
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => openEdit(entry)}
                    className="rounded-lg p-2 text-[#26221C]/40 transition hover:bg-[#26221C]/5 hover:text-[#26221C]"
                    aria-label="Edit entry"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => void deleteEntry(entry.id)}
                    className="rounded-lg p-2 text-[#26221C]/40 transition hover:bg-red-50 hover:text-red-500"
                    aria-label="Delete entry"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {editing && (
        <Modal
          open
          onClose={() => setEditing(null)}
          title={editing.id ? "Edit Entry" : "Add Entry"}
          wide
        >
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Topic" hint="short slug, e.g. breakfast">
                <Input
                  value={editing.topic}
                  onChange={(e) => setEditing({ ...editing, topic: e.target.value })}
                />
              </Field>
              <Field label="Label" hint="display title">
                <Input
                  value={editing.label}
                  onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Body">
              <Textarea
                rows={4}
                value={editing.body}
                onChange={(e) => setEditing({ ...editing, body: e.target.value })}
              />
            </Field>
            {editing.body && stripPrices(editing.body) !== editing.body && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                What TALA will actually see (prices stripped): "{stripPrices(editing.body)}"
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tags" hint="semicolon-separated">
                <Input
                  value={editing.tags}
                  onChange={(e) => setEditing({ ...editing, tags: e.target.value })}
                  placeholder="breakfast;dining;hours"
                />
              </Field>
              <Field label="Sort order">
                <Input
                  type="number"
                  value={editing.sort_order}
                  onChange={(e) =>
                    setEditing({ ...editing, sort_order: Number(e.target.value) || 0 })
                  }
                />
              </Field>
            </div>
            <label className="flex items-center justify-between rounded-lg bg-[#FAF6EF] px-4 py-3">
              <span className="text-sm font-medium text-[#26221C]">Enabled</span>
              <Switch
                checked={editing.enabled}
                onChange={(v) => setEditing({ ...editing, enabled: v })}
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button onClick={() => void saveDraft()} disabled={saving}>
                {saving ? "Saving…" : "Save Entry"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
