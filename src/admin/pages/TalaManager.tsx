import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  Loader2,
  PlayCircle,
  RefreshCw,
  Sparkles,
  UserCheck,
  Volume2,
} from "lucide-react";
import { useCms } from "@/context/CmsContext";
import { useToast } from "@/context/ToastContext";
import { Button, Card, Field, Input, Select, Switch, Badge } from "@/components/ui";
import { PageHeader } from "../shared/PageHeader";
import {
  fetchOpenRouterModels,
  fetchOpenRouterVoiceModels,
  formatPrice,
  type OpenRouterModel,
} from "../shared/openRouterModels";
import { supabase, isSupabaseConnected } from "@/lib/supabase";
import type { CmsData, TalaSettings } from "@/types/cms";
import { useTalaChat } from "@/components/tala/useTalaChat";
import { useTalaVoice } from "@/components/tala/useTalaVoice";
import { buildTalaSystemPrompt } from "@/components/tala/talaPersona";
import { useTalaKnowledge } from "@/components/tala/useTalaKnowledge";
import { TALA_KOKORO_VOICES } from "@/components/tala/talaConfig";

// ---------------------------------------------------------------------------
// TALA settings — admin picks the OpenRouter model AND (for fast iteration
// while building) can paste an API key straight in here.
//
// Trade-off, stated plainly: this page's data is the same data the public
// site loads to render itself, so anything saved here — including this key
// — is technically readable by anyone who inspects the site's network
// requests. That's the same pattern this codebase already uses for the
// WhatsApp chatbot's API key field (see WhatsAppManager.tsx), so it's not a
// new risk class, just the same one applied to TALA. Fine for a key you're
// fine rotating during active building; swap it for the private Supabase
// Edge Function secret (never exposed) before this is production-final.
// ---------------------------------------------------------------------------

type SyncState = "idle" | "saving" | "verifying" | "synced" | "error";

interface TalaLead {
  id: string;
  name: string;
  contact: string;
  note: string;
  created_at: string;
}

interface TalaAuditRow {
  id: string;
  intent: string;
  urgency: string;
  department: string;
  guest_message: string;
  tools_used: string[];
  created_at: string;
}

const DB_ROW_KEY = "marina_terrace_payload";

export default function TalaManager() {
  const { data, update } = useCms();
  const { notify } = useToast();
  const tala = data.settings.tala;

  const [models, setModels] = useState<{ free: OpenRouterModel[]; paid: OpenRouterModel[] } | null>(
    null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingModels, setLoadingModels] = useState(true);

  // ---- Voice models — OpenRouter's hosted TTS catalog (paid, same key as
  // the chat brain). Kokoro (free, in-browser) is the default; this is the
  // opt-in upgrade for both lower latency and hosted-voice quality.
  const [ttsModels, setTtsModels] = useState<OpenRouterModel[] | null>(null);
  const [ttsLoadError, setTtsLoadError] = useState<string | null>(null);
  const [loadingTtsModels, setLoadingTtsModels] = useState(true);
  const [ttsVoiceIdInput, setTtsVoiceIdInput] = useState(tala.ttsVoiceId);

  // Female-only filter for the Kokoro voice picker (TALA must stay female).
  const [femaleOnly, setFemaleOnly] = useState(true);

  const [sync, setSync] = useState<SyncState>("idle");
  const [keyInput, setKeyInput] = useState(tala.apiKey);
  const [showKey, setShowKey] = useState(false);

  // ---- Leads TALA has captured via the log_interested_guest tool.
  const [leads, setLeads] = useState<TalaLead[] | null>(null);
  const [leadsError, setLeadsError] = useState<string | null>(null);
  const [loadingLeads, setLoadingLeads] = useState(true);

  const loadLeads = useCallback(async () => {
    setLoadingLeads(true);
    setLeadsError(null);
    try {
      if (!isSupabaseConnected() || !supabase) {
        setLeads([]);
        return;
      }
      const { data: rows, error } = await supabase
        .from("tala_leads")
        .select("id, name, contact, note, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      setLeads((rows as TalaLead[]) ?? []);
    } catch (e) {
      setLeadsError(e instanceof Error ? e.message : "Couldn't load leads.");
    } finally {
      setLoadingLeads(false);
    }
  }, []);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  // ---- Agent activity — the audit node's output (tala_audit_log).
  const [auditRows, setAuditRows] = useState<TalaAuditRow[] | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [loadingAudit, setLoadingAudit] = useState(true);

  const loadAudit = useCallback(async () => {
    setLoadingAudit(true);
    setAuditError(null);
    try {
      if (!isSupabaseConnected() || !supabase) {
        setAuditRows([]);
        return;
      }
      const { data: rows, error } = await supabase
        .from("tala_audit_log")
        .select("id, intent, urgency, department, guest_message, tools_used, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      setAuditRows((rows as TalaAuditRow[]) ?? []);
    } catch (e) {
      setAuditError(e instanceof Error ? e.message : "Couldn't load agent activity.");
    } finally {
      setLoadingAudit(false);
    }
  }, []);

  useEffect(() => {
    void loadAudit();
  }, [loadAudit]);

  const loadModels = async () => {
    setLoadingModels(true);
    setLoadError(null);
    try {
      const result = await fetchOpenRouterModels();
      setModels(result);
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "Could not reach OpenRouter's model list right now.",
      );
    } finally {
      setLoadingModels(false);
    }
  };

  const loadTtsModels = async () => {
    setLoadingTtsModels(true);
    setTtsLoadError(null);
    try {
      setTtsModels(await fetchOpenRouterVoiceModels());
    } catch (e) {
      setTtsLoadError(
        e instanceof Error ? e.message : "Could not reach OpenRouter's voice model list right now.",
      );
    } finally {
      setLoadingTtsModels(false);
    }
  };

  useEffect(() => {
    void loadTtsModels();
  }, []);

  useEffect(() => {
    void loadModels();
  }, []);

  const allModels = useMemo(() => [...(models?.free ?? []), ...(models?.paid ?? [])], [models]);
  const selected = allModels.find((m) => m.id === tala.modelId) ?? null;

  const patchTala = (fn: (t: TalaSettings) => TalaSettings) =>
    update((d) => ({ ...d, settings: { ...d.settings, tala: fn(d.settings.tala) } }));

  const chooseModel = async (modelId: string) => {
    if (!modelId) {
      patchTala((t) => ({
        ...t,
        modelId: "",
        modelLabel: "",
        isFreeModel: true,
        updatedAt: new Date().toISOString(),
      }));
      notify("Reverted to the built-in free-model fallback chain");
      return;
    }
    const model = allModels.find((m) => m.id === modelId);
    if (!model) return;

    const nextTala: TalaSettings = {
      ...tala,
      modelId: model.id,
      modelLabel: model.name,
      isFreeModel: model.isFree,
      updatedAt: new Date().toISOString(),
    };
    patchTala(() => nextTala);
    notify(`TALA model set to ${model.name}`);
    await confirmSynced((cloudTala) => cloudTala?.modelId === nextTala.modelId);
  };

  // Confirm a change actually round-tripped to Supabase (the "green light").
  // CmsContext debounces its save by 400ms, then the upsert itself is a
  // network round trip — a single check shortly after often fires before the
  // write has landed, showing a false "couldn't confirm" error. Poll a few
  // times instead of checking once.
  const confirmSynced = async (matches: (cloudTala: TalaSettings | undefined) => boolean) => {
    setSync("saving");
    await new Promise((r) => setTimeout(r, 500));
    setSync("verifying");

    if (!isSupabaseConnected() || !supabase) {
      setSync("synced"); // localStorage-only mode: save() completing is the whole story
      return;
    }

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const { data: row, error } = await supabase
          .from("cms_data")
          .select("value")
          .eq("key", DB_ROW_KEY)
          .maybeSingle();
        const cloudTala = (row?.value as Partial<CmsData> | undefined)?.settings?.tala;
        if (!error && matches(cloudTala)) {
          setSync("synced");
          return;
        }
      } catch {
        // fall through to retry
      }
      await new Promise((r) => setTimeout(r, 600));
    }
    setSync("error");
  };

  const toggleEnabled = (on: boolean) => {
    patchTala((t) => ({ ...t, enabled: on, updatedAt: new Date().toISOString() }));
    notify(on ? "TALA enabled on the site" : "TALA hidden from the site");
  };

  const saveKey = async () => {
    const trimmed = keyInput.trim();
    patchTala((t) => ({ ...t, apiKey: trimmed, updatedAt: new Date().toISOString() }));
    notify(trimmed ? "API key saved — TALA is live" : "API key cleared");
    await confirmSynced((cloudTala) => cloudTala?.apiKey === trimmed);
  };

  // ---- Live test — runs the exact same pipeline a visitor's browser would,
  // right here in admin, so there's no back-and-forth to the public site.
  const chat = useTalaChat();
  const voice = useTalaVoice({
    defaultVoiceId: tala.voiceId || undefined,
    provider: tala.voiceProvider,
    apiKey: tala.apiKey || undefined,
    ttsModelId: tala.ttsModelId || undefined,
    ttsVoiceId: tala.ttsVoiceId || undefined,
  });
  const knowledge = useTalaKnowledge();
  const systemPrompt = useMemo(
    () => buildTalaSystemPrompt(data, knowledge.entries),
    [data, knowledge.entries],
  );
  const [testMessage, setTestMessage] = useState(
    "What rooms do you have and what's the wifi like?",
  );

  const lastReply = [...chat.messages].reverse().find((m) => m.role === "assistant");
  const testState: "idle" | "testing" | "success" | "error" = chat.thinking
    ? "testing"
    : chat.error
      ? "error"
      : lastReply
        ? "success"
        : "idle";

  const runTest = async () => {
    voice.stop();
    const reply = await chat.send(testMessage, systemPrompt, {
      model: tala.modelId || undefined,
      adminApiKey: tala.apiKey || undefined,
      cms: data,
    });
    if (reply) voice.speak(reply);
    void loadLeads(); // pick up a new lead if the test triggered log_interested_guest
    void loadAudit(); // pick up this turn's classify + audit entry
  };

  const chooseVoice = async (voiceId: string) => {
    voice.setVoiceId(voiceId); // swap immediately so "Test TALA Live" uses it too
    patchTala((t) => ({ ...t, voiceId, updatedAt: new Date().toISOString() }));
    const chosen = TALA_KOKORO_VOICES.find((v) => v.id === voiceId);
    notify(`TALA's voice set to ${chosen?.label.split(" — ")[0] || voiceId}`);
    await confirmSynced((cloudTala) => cloudTala?.voiceId === voiceId);
  };

  const chooseVoiceProvider = async (provider: "kokoro" | "openrouter") => {
    voice.stop();
    patchTala((t) => ({ ...t, voiceProvider: provider, updatedAt: new Date().toISOString() }));
    notify(
      provider === "kokoro"
        ? "Voice set back to free (Kokoro, in-browser)"
        : "Voice set to OpenRouter — real cost, no local download",
    );
    await confirmSynced((cloudTala) => cloudTala?.voiceProvider === provider);
  };

  const chooseTtsModel = async (modelId: string) => {
    voice.stop();
    const model = ttsModels?.find((m) => m.id === modelId);
    patchTala((t) => ({
      ...t,
      ttsModelId: modelId,
      ttsModelLabel: model?.name ?? "",
      updatedAt: new Date().toISOString(),
    }));
    if (modelId) notify(`Voice model set to ${model?.name ?? modelId}`);
    await confirmSynced((cloudTala) => cloudTala?.ttsModelId === modelId);
  };

  const saveTtsVoiceId = async () => {
    const trimmed = ttsVoiceIdInput.trim();
    voice.stop();
    patchTala((t) => ({ ...t, ttsVoiceId: trimmed, updatedAt: new Date().toISOString() }));
    notify(trimmed ? `Voice ID set to "${trimmed}"` : "Voice ID cleared");
    await confirmSynced((cloudTala) => cloudTala?.ttsVoiceId === trimmed);
  };

  return (
    <div>
      <PageHeader
        title="TALA — AI Voice Concierge"
        description="Pick which AI model powers TALA's answers. The voice itself (Kokoro, in-browser) is separate and always free."
        actions={
          <Link to="/admin/tala/knowledge">
            <Button variant="outline" size="sm">
              <BookOpen className="h-4 w-4" /> Knowledge Base ({knowledge.entries.length})
            </Button>
          </Link>
        }
      />

      {/* Readiness strip — everything you'd otherwise check on the live site */}
      <div className="mb-6 flex flex-wrap gap-2">
        <StatusChip
          tone={tala.apiKey ? "green" : "gray"}
          label={tala.apiKey ? "API key set" : "No key — using free fallback"}
        />
        <StatusChip
          tone="green"
          label={
            tala.modelId
              ? `Model: ${tala.modelLabel || tala.modelId}`
              : "Model: automatic free fallback"
          }
        />
        <StatusChip
          tone={
            testState === "success"
              ? "green"
              : testState === "error"
                ? "red"
                : testState === "testing"
                  ? "amber"
                  : "gray"
          }
          label={
            testState === "success"
              ? "Live test passed"
              : testState === "error"
                ? "Live test failed"
                : testState === "testing"
                  ? "Testing…"
                  : "Not tested yet"
          }
        />
        <StatusChip
          tone={voice.engine === "kokoro" ? "green" : voice.engine === "browser" ? "amber" : "gray"}
          label={
            voice.engine === "kokoro"
              ? "Voice ready (natural)"
              : voice.loadProgress !== null
                ? `Voice loading… ${voice.loadProgress}%`
                : voice.engine === "browser"
                  ? "Voice ready (standard)"
                  : "Voice not started"
          }
        />
      </div>

      <Card className="mb-6 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1F3D2B]/10">
              <Sparkles className="h-5 w-5 text-[#1F3D2B]" />
            </div>
            <div>
              <p className="font-serif text-lg text-[#26221C]">Show TALA on the site</p>
              <p className="text-xs text-[#26221C]/50">
                Turns the floating chat widget on or off for every visitor.
              </p>
            </div>
          </div>
          <Switch checked={tala.enabled} onChange={toggleEnabled} />
        </div>
      </Card>

      <Card className="mb-6 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="font-serif text-lg text-[#26221C]">OpenRouter API Key</p>
            <p className="mt-1 text-sm text-[#26221C]/55">
              Paste your key here to make TALA work right now, no deploy step needed. Fast for
              building — see the note below on why this isn't where a final production key should
              live.
            </p>
          </div>
          <Badge
            className={tala.apiKey ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}
          >
            {tala.apiKey ? "Key set — TALA is live" : "No key yet"}
          </Badge>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field label="API Key">
              <div className="relative">
                <Input
                  type={showKey ? "text" : "password"}
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="sk-or-v1-…"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#26221C]/40 hover:text-[#26221C]"
                  aria-label={showKey ? "Hide key" : "Show key"}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
          </div>
          <Button onClick={saveKey} disabled={keyInput === tala.apiKey}>
            Save Key
          </Button>
        </div>
      </Card>

      <Card className="mb-6 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="font-serif text-lg text-[#26221C]">Model</p>
            <p className="mt-1 text-sm text-[#26221C]/55">
              All current OpenRouter models, free and paid, A–Z. Free models cost nothing to run;
              paid models are billed to your OpenRouter account per use.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadModels} disabled={loadingModels}>
            <RefreshCw className={`h-3.5 w-3.5 ${loadingModels ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {loadError && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{loadError}</p>
          </div>
        )}

        <Field
          label="Active model"
          hint="Leave on the default to let TALA automatically use free models with fallback."
        >
          <Select
            value={tala.modelId}
            onChange={(e) => void chooseModel(e.target.value)}
            disabled={loadingModels}
          >
            <option value="">— Default: automatic free-model fallback —</option>
            {models && models.free.length > 0 && (
              <optgroup label={`Free models (${models.free.length})`}>
                {models.free.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </optgroup>
            )}
            {models && models.paid.length > 0 && (
              <optgroup label={`Paid models (${models.paid.length})`}>
                {models.paid.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {formatPrice(m)}
                  </option>
                ))}
              </optgroup>
            )}
          </Select>
        </Field>

        {selected && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-[#FAF6EF] px-4 py-3 text-sm">
            <Badge
              className={
                selected.isFree ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
              }
            >
              {selected.isFree ? "Free" : "Paid"}
            </Badge>
            <span className="text-[#26221C]/70">{selected.id}</span>
            {!selected.isFree && (
              <span className="text-[#26221C]/50">· {formatPrice(selected)}</span>
            )}
            {selected.contextLength && (
              <span className="text-[#26221C]/50">
                · {selected.contextLength.toLocaleString()} token context
              </span>
            )}
          </div>
        )}

        {/* Sync indicator — the "green light" */}
        <div className="mt-4 flex items-center gap-2 text-sm">
          {sync === "idle" && (
            <span className="text-[#26221C]/40">No changes yet this session.</span>
          )}
          {sync === "saving" && (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-[#26221C]/50" />
              <span className="text-[#26221C]/60">Saving…</span>
            </>
          )}
          {sync === "verifying" && (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-[#26221C]/50" />
              <span className="text-[#26221C]/60">Confirming it reached the live site…</span>
            </>
          )}
          {sync === "synced" && (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="font-medium text-green-700">
                Synced — TALA on the live site is now using this model.
              </span>
            </>
          )}
          {sync === "error" && (
            <>
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-red-600">
                Saved locally, but couldn't confirm the cloud copy. Refresh this page to check
                again.
              </span>
            </>
          )}
        </div>
      </Card>

      <Card className="mb-6 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="font-serif text-lg text-[#26221C]">Voice</p>
            <p className="mt-1 text-sm text-[#26221C]/55">
              Kokoro runs free, entirely in the visitor's browser — but the ~80 MB model has to
              download before she can speak the first time. OpenRouter's hosted voices use the same
              key as your chat brain above: real per-character cost, but no download wait.
            </p>
          </div>
          <Badge
            className={
              voice.engine === "kokoro" || voice.engine === "openrouter"
                ? "bg-green-100 text-green-700"
                : "bg-amber-100 text-amber-700"
            }
          >
            {voice.engine === "openrouter"
              ? "OpenRouter — ready"
              : voice.engine === "kokoro"
                ? "Kokoro — loaded"
                : voice.loadProgress !== null
                  ? `Loading ${voice.loadProgress}%`
                  : "Not loaded yet"}
          </Badge>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-[#FAF6EF] p-1">
          <button
            onClick={() => void chooseVoiceProvider("kokoro")}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              tala.voiceProvider === "kokoro"
                ? "bg-white text-[#26221C] shadow-sm"
                : "text-[#26221C]/50 hover:text-[#26221C]"
            }`}
          >
            Kokoro — free, in-browser
          </button>
          <button
            onClick={() => void chooseVoiceProvider("openrouter")}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              tala.voiceProvider === "openrouter"
                ? "bg-white text-[#26221C] shadow-sm"
                : "text-[#26221C]/50 hover:text-[#26221C]"
            }`}
          >
            OpenRouter — paid, no lag
          </button>
        </div>

        {tala.voiceProvider === "kokoro" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-[#26221C]">
                Female voices — tap <span className="font-mono">▶</span> to hear, tap the row to choose
              </p>
              <label className="flex items-center gap-1.5 text-xs text-[#26221C]/60">
                <input
                  type="checkbox"
                  checked={femaleOnly}
                  onChange={(e) => setFemaleOnly(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[#1F3D2B]"
                />
                Female only
              </label>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {TALA_KOKORO_VOICES.filter((v) => (femaleOnly ? v.gender === "female" : true)).map((v) => {
                const isChosen = tala.voiceId === v.id;
                const isPlaying = voice.previewId === v.id;
                const name = v.label.split(" — ")[0];
                return (
                  <div
                    key={v.id}
                    className={`flex items-center gap-2 rounded-xl border p-2.5 transition ${
                      isChosen
                        ? "border-[#C6A15B] bg-[#C6A15B]/10 shadow-sm"
                        : "border-[#26221C]/10 bg-white hover:border-[#C6A15B]/40"
                    }`}
                  >
                    {/* Green light on the chosen voice */}
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                        isChosen ? "bg-green-500 shadow-[0_0_8px_2px_rgba(34,197,94,0.5)]" : "bg-[#26221C]/15"
                      }`}
                      title={isChosen ? "TALA's live voice" : ""}
                    />
                    <button
                      type="button"
                      onClick={() => void chooseVoice(v.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-sm font-medium text-[#26221C]">{name}</p>
                      <p className="truncate text-[11px] text-[#26221C]/50">
                        {v.gender === "female" ? "Female" : "Male"} · {v.accent === "british" ? "British" : "American"}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => voice.preview(v.id)}
                      disabled={Boolean(voice.previewId)}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white transition ${
                        isPlaying ? "bg-[#C6A15B]" : "bg-[#1F3D2B] hover:opacity-90"
                      }`}
                      title="Play sample"
                    >
                      {isPlaying ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <PlayCircle className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            <p className="text-[11px] text-[#26221C]/45">
              All Kokoro voices are free and run in the visitor's browser. The green-lit voice is what every guest
              hears. Pick one, then use “Test TALA Live” below to confirm.
            </p>
          </div>
        )}

        {tala.voiceProvider === "openrouter" && (
          <div className="space-y-4">
            {!tala.apiKey && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  No API key set yet — add one in the OpenRouter API Key card above. OpenRouter TTS
                  uses that same key.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-[#26221C]">Voice model</p>
              <Button
                variant="outline"
                size="sm"
                onClick={loadTtsModels}
                disabled={loadingTtsModels}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingTtsModels ? "animate-spin" : ""}`} />{" "}
                Refresh
              </Button>
            </div>

            {ttsLoadError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{ttsLoadError}</p>
              </div>
            )}

            <Field
              label="Model"
              hint="Hosted TTS models on OpenRouter — MiniMax, GPT-4o Mini TTS, Voxtral, and others."
            >
              <Select
                value={tala.ttsModelId}
                onChange={(e) => void chooseTtsModel(e.target.value)}
                disabled={loadingTtsModels}
              >
                <option value="">— Choose a voice model —</option>
                {ttsModels?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {formatPrice(m)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Voice ID"
              hint='Each model defines its own voice set — check its OpenRouter page. Examples: OpenAI uses "nova" or "alloy"; Voxtral uses "en_paul_happy".'
            >
              <div className="flex gap-2">
                <Input
                  value={ttsVoiceIdInput}
                  onChange={(e) => setTtsVoiceIdInput(e.target.value)}
                  placeholder="e.g. nova"
                />
                <Button
                  onClick={() => void saveTtsVoiceId()}
                  disabled={ttsVoiceIdInput === tala.ttsVoiceId}
                >
                  Save
                </Button>
              </div>
            </Field>

            {tala.ttsModelId && !tala.ttsVoiceId && (
              <p className="text-xs text-amber-700">
                Pick a voice ID above — TALA will fall back to the standard browser voice until one
                is set.
              </p>
            )}
          </div>
        )}
      </Card>

      <Card className="mb-6 p-6">
        <div className="mb-4">
          <p className="font-serif text-lg text-[#26221C]">Test TALA Live</p>
          <p className="mt-1 text-sm text-[#26221C]/55">
            Runs the exact same chat + voice pipeline a visitor's browser uses — right here, so you
            can confirm everything works without opening the site.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field label="Test question">
              <Input
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="Ask TALA something a guest would ask…"
              />
            </Field>
          </div>
          <Button onClick={() => void runTest()} disabled={chat.thinking || !testMessage.trim()}>
            {chat.thinking ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Testing…
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4" /> Run Test
              </>
            )}
          </Button>
        </div>

        {chat.error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{chat.error}</p>
          </div>
        )}

        {lastReply && (
          <div className="mt-4 rounded-xl border border-[#26221C]/10 bg-[#FAF6EF] p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#26221C]/45">
                TALA's reply
              </p>
              <button
                onClick={() => voice.speak(lastReply.content)}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#26221C]/15 px-3 py-1 text-xs font-medium text-[#26221C]/70 transition hover:border-[#C6A15B]/50 hover:text-[#C6A15B]"
              >
                <Volume2 className="h-3.5 w-3.5" /> Play voice
              </button>
            </div>
            <p className="text-sm leading-relaxed text-[#26221C]">{lastReply.content}</p>
          </div>
        )}

        {chat.lastRun && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[#26221C]/40">Agent graph:</span>
            <Badge className="bg-[#26221C]/8 text-[#26221C]/70">
              intent: {chat.lastRun.classification.intent}
            </Badge>
            <Badge className="bg-[#26221C]/8 text-[#26221C]/70">
              urgency: {chat.lastRun.classification.urgency}
            </Badge>
            <Badge className="bg-[#26221C]/8 text-[#26221C]/70">
              dept: {chat.lastRun.classification.department}
            </Badge>
            {chat.lastRun.toolsUsed.length > 0 && (
              <Badge className="bg-green-100 text-green-700">
                tools: {chat.lastRun.toolsUsed.join(", ")}
              </Badge>
            )}
          </div>
        )}

        {voice.status === "speaking" && (
          <p className="mt-3 flex items-center gap-2 text-xs text-[#26221C]/50">
            <Volume2 className="h-3.5 w-3.5 animate-pulse text-[#C6A15B]" /> Speaking…
          </p>
        )}
      </Card>

      <Card className="mb-6 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="font-serif text-lg text-[#26221C]">Leads TALA has captured</p>
            <p className="mt-1 text-sm text-[#26221C]/55">
              TALA can save a guest's interest with her log_interested_guest tool when they share a
              name or contact but the chat ends before they reach WhatsApp. Proof it's a real
              action, not just talk — this list is live.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadLeads()}
            disabled={loadingLeads}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingLeads ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {leadsError && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{leadsError}</p>
          </div>
        )}

        {!leadsError && leads && leads.length === 0 && (
          <p className="rounded-xl border border-dashed border-[#26221C]/15 bg-white/50 p-6 text-center text-sm text-[#26221C]/50">
            No leads yet. Run a test above where you mention your name and a way to reach you.
          </p>
        )}

        {leads && leads.length > 0 && (
          <div className="space-y-2">
            {leads.map((lead) => (
              <div
                key={lead.id}
                className="flex items-start gap-3 rounded-xl border border-[#26221C]/10 bg-[#FAF6EF] p-3"
              >
                <UserCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#C6A15B]" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-medium text-[#26221C]">
                      {lead.name || "(no name given)"}
                    </span>
                    {lead.contact && (
                      <span className="text-xs text-[#26221C]/50">{lead.contact}</span>
                    )}
                    <span className="text-xs text-[#26221C]/40">
                      {new Date(lead.created_at).toLocaleString()}
                    </span>
                  </div>
                  {lead.note && <p className="mt-1 text-sm text-[#26221C]/70">{lead.note}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="mb-6 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="font-serif text-lg text-[#26221C]">Agent activity</p>
            <p className="mt-1 text-sm text-[#26221C]/55">
              The agent graph's audit trail — every completed turn's classification and which tools
              ran (KAPWA's "log every significant action" rule, applied to TALA). Proof the classify
              → agent → audit pipeline is real, not just a chat completion.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadAudit()}
            disabled={loadingAudit}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingAudit ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {auditError && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{auditError}</p>
          </div>
        )}

        {!auditError && auditRows && auditRows.length === 0 && (
          <p className="rounded-xl border border-dashed border-[#26221C]/15 bg-white/50 p-6 text-center text-sm text-[#26221C]/50">
            No activity logged yet. Run a test above or have a conversation on the live site.
          </p>
        )}

        {auditRows && auditRows.length > 0 && (
          <div className="space-y-2">
            {auditRows.map((row) => (
              <div
                key={row.id}
                className="flex items-start gap-3 rounded-xl border border-[#26221C]/10 bg-[#FAF6EF] p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge className="bg-[#26221C]/8 text-[#26221C]/70">{row.intent}</Badge>
                    <Badge
                      className={
                        row.urgency === "high" || row.urgency === "urgent"
                          ? "bg-red-100 text-red-700"
                          : "bg-[#26221C]/8 text-[#26221C]/70"
                      }
                    >
                      {row.urgency}
                    </Badge>
                    <Badge className="bg-[#26221C]/8 text-[#26221C]/70">{row.department}</Badge>
                    {row.tools_used?.length > 0 && (
                      <Badge className="bg-green-100 text-green-700">
                        {row.tools_used.join(", ")}
                      </Badge>
                    )}
                    <span className="text-xs text-[#26221C]/40">
                      {new Date(row.created_at).toLocaleString()}
                    </span>
                  </div>
                  {row.guest_message && (
                    <p className="mt-1 truncate text-sm text-[#26221C]/70">{row.guest_message}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <div className="flex items-start gap-2 text-sm text-[#26221C]/70">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div>
            <p className="font-medium text-[#26221C]">Good for building, not for launch day</p>
            <p className="mt-1">
              The key above is stored in the same data the public site loads to render itself —
              which means, technically, anyone who opens their browser's network tab while visiting
              the site could read it. That's an acceptable trade while you're iterating fast and can
              rotate the key anytime. Before this goes fully public, move it to a private Supabase
              Edge Function secret (
              <code className="rounded bg-[#26221C]/5 px-1.5 py-0.5 text-xs">
                OPENROUTER_API_KEY
              </code>
              ) instead — same model picker above, key never exposed. One command when you're ready:{" "}
              <code className="rounded bg-[#26221C]/5 px-1.5 py-0.5 text-xs">
                supabase secrets set OPENROUTER_API_KEY=...
              </code>
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

const CHIP_TONES = {
  green: "border-green-200 bg-green-50 text-green-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  red: "border-red-200 bg-red-50 text-red-700",
  gray: "border-[#26221C]/10 bg-[#26221C]/5 text-[#26221C]/50",
} as const;

function StatusChip({ tone, label }: { tone: keyof typeof CHIP_TONES; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${CHIP_TONES[tone]}`}
    >
      <Circle
        className={`h-2 w-2 ${tone === "green" ? "fill-current" : "fill-current opacity-60"}`}
      />
      {label}
    </span>
  );
}
