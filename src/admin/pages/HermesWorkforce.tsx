import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  Bot,
  CheckCircle2,
  CircleDollarSign,
  Code2,
  Database,
  Eye,
  EyeOff,
  Github,
  KeyRound,
  Loader2,
  Mail,
  Megaphone,
  RefreshCw,
  Save,
  Send,
  Server,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  XCircle,
} from "lucide-react";
import { Button, Card, Field, Input } from "@/components/ui";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "../shared/PageHeader";

type AgentId = "supervisor" | "finance" | "leads" | "email" | "developer" | "operations";
type Message = { role: "user" | "assistant"; content: string };
type ConnectionStatus = {
  hermes: boolean;
  openrouter: boolean;
  supabase: boolean;
  email: boolean;
  github: boolean;
};

type OpenRouterModel = {
  id: string;
  name: string;
  free: boolean;
  contextLength: number;
  promptPrice: string;
  completionPrice: string;
  toolCalling: boolean;
};

type VerificationCheck = { ok: boolean; detail: string };
type Verification = {
  state: "not_run" | "ready" | "failed";
  ready: boolean;
  checks: Partial<Record<keyof ConnectionStatus, VerificationCheck>>;
  checkedAt: number | null;
};

type HermesSettings = {
  AI_PROVIDER: string;
  OPENROUTER_API_KEY: string;
  HERMES_MODEL: string;
  OLLAMA_BASE_URL: string;
  OLLAMA_MODEL: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  RESORT_CMS_KEY: string;
  TALA_GITHUB_REPOSITORY: string;
  GITHUB_TOKEN: string;
  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL: string;
};

type RuntimeStatus = {
  configured: boolean;
  gateway: boolean;
  connections: ConnectionStatus;
  settings?: Partial<HermesSettings>;
  secretsSet?: Partial<Record<keyof HermesSettings, boolean>>;
  verification?: Verification;
};

const ACCESS_KEY_STORAGE = "hermes.workforceAccessKey";
const RUNTIME_URL_STORAGE = "hermes.runtimeUrl";
const MARINA_HERMES_URL = "https://hermes.nomads.merqato.digital";
const EMPTY_SETTINGS: HermesSettings = {
  AI_PROVIDER: "openrouter",
  OPENROUTER_API_KEY: "",
  HERMES_MODEL: "openai/gpt-oss-20b",
  OLLAMA_BASE_URL: "http://host.docker.internal:11434/v1",
  OLLAMA_MODEL: "",
  SUPABASE_URL: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  RESORT_CMS_KEY: "marina_terrace_payload",
  TALA_GITHUB_REPOSITORY: "merqatodigital/set-sail-project",
  GITHUB_TOKEN: "",
  RESEND_API_KEY: "",
  RESEND_FROM_EMAIL: "",
};

const AGENTS: Array<{
  id: AgentId;
  name: string;
  duty: string;
  icon: typeof Bot;
  prompt: string;
}> = [
  {
    id: "supervisor",
    name: "Hermes Supervisor",
    duty: "Plans work and delegates it to the correct specialist.",
    icon: Sparkles,
    prompt: "Review today’s resort priorities and tell me what the team should do first.",
  },
  {
    id: "finance",
    name: "Financial Agent",
    duty: "Analyzes revenue, costs, occupancy, payroll and cash flow.",
    icon: CircleDollarSign,
    prompt: "Analyze the current resort finances and identify the three most important actions.",
  },
  {
    id: "leads",
    name: "Lead Agent",
    duty: "Reviews, qualifies and prepares follow-up for resort leads.",
    icon: Megaphone,
    prompt: "Review our newest leads, rank them and prepare the next follow-up actions.",
  },
  {
    id: "email",
    name: "Email Agent",
    duty: "Drafts guest, supplier and business email responses.",
    icon: Mail,
    prompt: "Review the communication workload and prepare the email replies that need attention.",
  },
  {
    id: "developer",
    name: "Developer Agent",
    duty: "Inspects code, diagnoses problems and prepares tested fixes.",
    icon: Code2,
    prompt: "Inspect the resort website project and report the most important technical risks.",
  },
  {
    id: "operations",
    name: "Operations Agent",
    duty: "Coordinates bookings, tours, rentals, food, messages and staff tasks.",
    icon: Users,
    prompt: "Prepare today’s resort operations briefing and flag anything requiring attention.",
  },
];

function readAccessKey() {
  try {
    return sessionStorage.getItem(ACCESS_KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

function readRuntimeUrl() {
  try {
    return localStorage.getItem(RUNTIME_URL_STORAGE) || MARINA_HERMES_URL;
  } catch {
    return MARINA_HERMES_URL;
  }
}

function connectionLabel(value: boolean) {
  return value ? "Connected" : "Not connected";
}

export default function HermesWorkforce() {
  const [agentId, setAgentId] = useState<AgentId>("supervisor");
  const [accessKey, setAccessKey] = useState(readAccessKey);
  const [keyInput, setKeyInput] = useState(readAccessKey);
  const [runtimeUrl, setRuntimeUrl] = useState(readRuntimeUrl);
  const [runtimeUrlInput, setRuntimeUrlInput] = useState(readRuntimeUrl);
  const [settings, setSettings] = useState<HermesSettings>(EMPTY_SETTINGS);
  const [showSettings, setShowSettings] = useState(true);
  const [showSecrets, setShowSecrets] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [ollamaModels, setOllamaModels] = useState<Array<{ id: string; name: string; size: number }>>([]);
  const [ollamaLoading, setOllamaLoading] = useState(false);
  const [modelFilter, setModelFilter] = useState<"all" | "free" | "paid">("free");
  const [modelSearch, setModelSearch] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [error, setError] = useState("");
  const [ownerToken, setOwnerToken] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerAuthMessage, setOwnerAuthMessage] = useState("");
  const [ownerAuthBusy, setOwnerAuthBusy] = useState(false);
  const [secretsSet, setSecretsSet] = useState<Partial<Record<keyof HermesSettings, boolean>>>({});
  const sessionRef = useRef(`admin:${crypto.randomUUID()}`);

  const selected = useMemo(() => AGENTS.find((agent) => agent.id === agentId)!, [agentId]);
  const SelectedIcon = selected.icon;
  const operational = verification?.ready === true;
  const filteredModels = useMemo(() => {
    const query = modelSearch.trim().toLowerCase();
    return models.filter((model) => {
      if (modelFilter === "free" && !model.free) return false;
      if (modelFilter === "paid" && model.free) return false;
      return !query || model.name.toLowerCase().includes(query) || model.id.toLowerCase().includes(query);
    });
  }, [modelFilter, modelSearch, models]);
  const selectedOpenRouterModel = useMemo(
    () => models.find((model) => model.id === settings.HERMES_MODEL),
    [models, settings.HERMES_MODEL],
  );

  const ownerHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${ownerToken}`,
  });

  const loadSavedConfiguration = async (token = ownerToken) => {
    if (!token) return;
    try {
      const response = await fetch("/api/hermes/settings", { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Unable to load saved Hermes settings.");
      setSettings((current) => ({ ...current, ...data.settings }));
      setSecretsSet(data.secretsSet || {});
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load saved Hermes settings.");
    }
  };

  const sendOwnerSignIn = async () => {
    const email = ownerEmail.trim();
    if (!email || ownerAuthBusy) return;
    setOwnerAuthBusy(true);
    setOwnerAuthMessage("");
    try {
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.href },
      });
      if (signInError) throw signInError;
      setOwnerAuthMessage("Check your email and open the secure sign-in link. This page will then unlock your Hermes settings.");
    } catch (reason) {
      setOwnerAuthMessage(reason instanceof Error ? reason.message : "Unable to send the sign-in link.");
    } finally {
      setOwnerAuthBusy(false);
    }
  };

  const refreshStatus = async () => {
    if (!ownerToken) return;
    setError("");
    try {
      const response = await fetch("/api/hermes/status", { headers: ownerHeaders() });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Unable to reach Hermes.");
      const runtime = data as RuntimeStatus;
      setStatus(runtime.connections);
      setVerification(runtime.verification ?? null);
      if (runtime.settings) {
        setSettings((current) => ({ ...current, ...runtime.settings }));
      }
      if (!runtime.configured) setShowSettings(true);
    } catch (reason) {
      setStatus(null);
      setShowSettings(true);
      setError(reason instanceof Error ? reason.message : "Unable to reach Hermes.");
    }
  };

  const loadModels = async (key = accessKey, url = runtimeUrl) => {
    if (modelsLoading) return;
    setModelsLoading(true);
    try {
      let loaded: OpenRouterModel[] = [];
      if (key && url) {
        try {
          const response = await fetch(`${url.replace(/\/$/, "")}/models`, {
            headers: { Authorization: `Bearer ${key}` },
          });
          const data = await response.json().catch(() => null);
          if (response.ok && Array.isArray(data?.models)) loaded = data.models;
        } catch {
          // The public catalog below keeps model selection usable while Hermes is offline.
        }
      }
      if (!loaded.length) {
        let response = await fetch("/api/openrouter/models");
        if (!response.ok) response = await fetch("https://openrouter.ai/api/v1/models");
        const data = await response.json().catch(() => null);
        if (!response.ok || !Array.isArray(data?.data)) throw new Error("Unable to load OpenRouter models.");
        loaded = data.data.map((item: Record<string, unknown>) => {
          const pricing = item.pricing && typeof item.pricing === "object" ? item.pricing as Record<string, unknown> : {};
          const promptPrice = String(pricing.prompt ?? "0");
          const completionPrice = String(pricing.completion ?? "0");
          const free = (Number(promptPrice) === 0 && Number(completionPrice) === 0) || String(item.id || "").endsWith(":free");
          const supported = Array.isArray(item.supported_parameters) ? item.supported_parameters : [];
          return {
            id: String(item.id || ""),
            name: String(item.name || item.id || ""),
            free,
            contextLength: Number(item.context_length || 0),
            promptPrice,
            completionPrice,
            toolCalling: supported.includes("tools"),
          };
        }).filter((model: OpenRouterModel) => model.id);
      }
      setModels(loaded);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load OpenRouter models.");
    } finally {
      setModelsLoading(false);
    }
  };

  const syncOllamaModels = async () => {
    if (!runtimeUrl || !accessKey || ollamaLoading) return;
    setOllamaLoading(true);
    setError("");
    try {
      const response = await fetch(`${runtimeUrl}/ollama/models`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessKey}` },
        body: JSON.stringify({ baseUrl: settings.OLLAMA_BASE_URL }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Unable to sync the Ollama machine.");
      const loaded = Array.isArray(data?.models) ? data.models : [];
      setOllamaModels(loaded);
      if (loaded.length && !loaded.some((model: { id: string }) => model.id === settings.OLLAMA_MODEL)) {
        patchSetting("OLLAMA_MODEL", loaded[0].id);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to sync the Ollama machine.");
    } finally {
      setOllamaLoading(false);
    }
  };

  const verifyRuntime = async () => {
    if (!ownerToken || verifying) return false;
    setVerifying(true);
    setError("");
    try {
      const response = await fetch("/api/hermes/verify", {
        method: "POST",
        headers: ownerHeaders(),
        body: "{}",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Hermes verification failed.");
      const result = data as Verification;
      setVerification(result);
      setStatus({
        hermes: Boolean(result.checks.hermes?.ok),
        openrouter: Boolean(result.checks.openrouter?.ok),
        supabase: Boolean(result.checks.supabase?.ok),
        email: Boolean(result.checks.email?.ok),
        github: Boolean(result.checks.github?.ok),
      });
      if (!result.ready) setError("Hermes is not fully operational yet. Open Settings and review the failed connections below.");
      return result.ready;
    } catch (reason) {
      setVerification({ state: "failed", ready: false, checks: {}, checkedAt: null });
      setError(reason instanceof Error ? reason.message : "Hermes verification failed.");
      return false;
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    const applySession = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      setOwnerToken(session?.access_token || "");
      setOwnerEmail(session?.user.email || "");
      if (session?.access_token) void loadSavedConfiguration(session.access_token);
    };
    void applySession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setOwnerToken(session?.access_token || "");
      setOwnerEmail(session?.user.email || "");
      if (session?.access_token) void loadSavedConfiguration(session.access_token);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    void loadModels();
    if (ownerToken) void refreshStatus();
  }, [ownerToken]);

  const unlock = () => {
    const value = keyInput.trim();
    const url = runtimeUrlInput.trim().replace(/\/$/, "");
    if (!value || !/^https?:\/\//i.test(url)) {
      setError("Enter the Hermes server URL and access key.");
      return;
    }
    sessionStorage.setItem(ACCESS_KEY_STORAGE, value);
    localStorage.setItem(RUNTIME_URL_STORAGE, url);
    setAccessKey(value);
    setRuntimeUrl(url);
    setShowSettings(true);
  };

  const patchSetting = (key: keyof HermesSettings, value: string) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const saveConfiguration = async () => {
    if (!ownerToken || savingSettings) return;
    setSavingSettings(true);
    setError("");
    try {
      const settingsResponse = await fetch("/api/hermes/settings", {
        method: "PUT",
        headers: ownerHeaders(),
        body: JSON.stringify({ settings }),
      });
      const settingsData = await settingsResponse.json().catch(() => null);
      if (!settingsResponse.ok) throw new Error(settingsData?.error || "Unable to save Hermes settings.");
      setSecretsSet((current) => ({
        ...current,
        OPENROUTER_API_KEY: Boolean(settings.OPENROUTER_API_KEY) || current.OPENROUTER_API_KEY,
        SUPABASE_SERVICE_ROLE_KEY: Boolean(settings.SUPABASE_SERVICE_ROLE_KEY) || current.SUPABASE_SERVICE_ROLE_KEY,
        GITHUB_TOKEN: Boolean(settings.GITHUB_TOKEN) || current.GITHUB_TOKEN,
        RESEND_API_KEY: Boolean(settings.RESEND_API_KEY) || current.RESEND_API_KEY,
      }));
      setSettings((current) => ({
        ...current,
        OPENROUTER_API_KEY: "",
        SUPABASE_SERVICE_ROLE_KEY: "",
        GITHUB_TOKEN: "",
        RESEND_API_KEY: "",
      }));
      const ready = await verifyRuntime();
      await refreshStatus();
      if (ready) setShowSettings(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save Hermes settings.");
    } finally {
      setSavingSettings(false);
    }
  };

  const changeAgent = (next: AgentId) => {
    setAgentId(next);
    setMessages([]);
    setError("");
    sessionRef.current = `admin:${next}:${crypto.randomUUID()}`;
  };

  const sendMessage = async (text = input) => {
    const content = text.trim();
    if (!content || working) return;
    const nextMessages: Message[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");
    setError("");
    setWorking(true);
    try {
      const response = await fetch("/api/hermes/workforce", {
        method: "POST",
        headers: ownerHeaders(),
        body: JSON.stringify({ agent: agentId, messages: nextMessages, session: sessionRef.current }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Hermes could not complete the task.");
      const reply = data?.choices?.[0]?.message?.content?.trim();
      if (!reply) throw new Error("Hermes returned an empty reply.");
      setMessages((current) => [...current, { role: "assistant", content: reply }]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Hermes could not complete the task.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Hermes Workforce"
        description="One supervisor and specialized agents using the resort’s existing data, tools and knowledge."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowSettings((value) => !value)}>
              <Settings2 className="h-4 w-4" /> Settings
            </Button>
            <Button variant="outline" size="sm" onClick={() => void verifyRuntime()} disabled={verifying || !ownerToken}>
              <RefreshCw className={`h-4 w-4 ${verifying ? "animate-spin" : ""}`} />
              {verifying ? "Running live test" : "Check connections"}
            </Button>
          </div>
        }
      />

      {!ownerToken && (
        <Card className="mb-6 max-w-xl space-y-4 border-[#C6A15B]/35 p-6">
          <div className="flex items-center gap-2 font-medium text-[#26221C]"><ShieldCheck className="h-4 w-4 text-[#C6A15B]" /> Secure owner sign-in</div>
          <p className="text-sm leading-relaxed text-[#26221C]/60">Sign in with the owner email already approved in Supabase. This is what allows Hermes settings and API keys to be stored securely.</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input type="email" value={ownerEmail} onChange={(event) => setOwnerEmail(event.target.value)} placeholder="Owner email" />
            <Button onClick={() => void sendOwnerSignIn()} disabled={ownerAuthBusy || !ownerEmail.trim()}>
              {ownerAuthBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Send sign-in link
            </Button>
          </div>
          {ownerAuthMessage && <p className="text-sm text-[#8A6B32]">{ownerAuthMessage}</p>}
        </Card>
      )}

      {ownerToken && (
        <Card className="mb-6 max-w-xl border-[#C6A15B]/35 p-5">
          <div className="flex items-center gap-2 font-medium text-[#26221C]"><Server className="h-4 w-4 text-[#C6A15B]" /> Hermes runs inside TALA</div>
          <p className="mt-2 text-sm leading-relaxed text-[#26221C]/60">No Docker address or browser access key is needed for OpenRouter. TALA sends your selected model and private settings through its secured server connection.</p>
        </Card>
      )}

      <div className={`mb-6 flex items-start gap-3 rounded-2xl border px-5 py-4 ${
        operational
          ? "border-emerald-300 bg-emerald-50 text-emerald-900"
          : "border-amber-200 bg-amber-50 text-amber-950"
      }`}>
        {operational ? (
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
        ) : verifying ? (
          <Loader2 className="mt-0.5 h-6 w-6 shrink-0 animate-spin text-amber-700" />
        ) : (
          <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-amber-700" />
        )}
        <div>
          <p className="font-semibold">
            {operational ? "Hermes is operational" : verifying ? "Testing the complete Hermes system" : "Hermes setup is not complete"}
          </p>
          <p className="mt-1 text-sm opacity-75">
            {operational
              ? `The live Hermes agent, ${settings.AI_PROVIDER === "ollama" ? settings.OLLAMA_MODEL : settings.HERMES_MODEL}, and Marina resort data all passed.`
              : "A green light appears only after the real agent, selected OpenRouter model, and Supabase data pass live tests."}
          </p>
        </div>
      </div>

      {showSettings && (
        <Card className="mb-6 space-y-6 border-[#C6A15B]/35 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-serif text-2xl text-[#26221C]">Hermes Setup</h2>
              <p className="mt-1 text-sm text-[#26221C]/55">The owner configures every connection here. API keys are stored in private Supabase storage and are never returned to this page.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowSecrets((value) => !value)}>
              {showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showSecrets ? "Hide" : "Show"} secrets
            </Button>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4 rounded-xl border border-[#26221C]/10 p-5">
              <div className="flex items-center gap-2 font-medium text-[#26221C]"><Bot className="h-4 w-4 text-[#C6A15B]" /> AI Model</div>
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#26221C]/5 p-1">
                <button
                  type="button"
                  onClick={() => patchSetting("AI_PROVIDER", "openrouter")}
                  className={`rounded-lg px-3 py-2 text-sm font-medium ${settings.AI_PROVIDER !== "ollama" ? "bg-white text-[#26221C] shadow-sm" : "text-[#26221C]/50"}`}
                >
                  OpenRouter
                </button>
                <button
                  type="button"
                  onClick={() => patchSetting("AI_PROVIDER", "ollama")}
                  className={`rounded-lg px-3 py-2 text-sm font-medium ${settings.AI_PROVIDER === "ollama" ? "bg-white text-[#26221C] shadow-sm" : "text-[#26221C]/50"}`}
                >
                  Ollama Machine
                </button>
              </div>

              {settings.AI_PROVIDER !== "ollama" ? (
                <>
                  <Field label="OpenRouter API Key">
                    <Input type={showSecrets ? "text" : "password"} value={settings.OPENROUTER_API_KEY} onChange={(e) => patchSetting("OPENROUTER_API_KEY", e.target.value)} placeholder="Leave blank to keep the saved key" />
                  </Field>
                  {secretsSet.OPENROUTER_API_KEY && <p className="-mt-3 text-xs text-emerald-700">OpenRouter key saved privately</p>}
                  <Field label="OpenRouter Model">
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {(["free", "paid", "all"] as const).map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setModelFilter(filter)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize ${
                          modelFilter === filter
                            ? "border-[#C6A15B] bg-[#C6A15B] text-white"
                            : "border-[#26221C]/15 bg-white text-[#26221C]/60"
                        }`}
                      >
                        {filter === "all" ? "All models" : `${filter} models`}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => void loadModels()}
                      className="ml-auto flex items-center gap-1 text-xs text-[#8A6B32]"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${modelsLoading ? "animate-spin" : ""}`} /> Refresh list
                    </button>
                  </div>
                  <Input
                    value={modelSearch}
                    onChange={(event) => setModelSearch(event.target.value)}
                    placeholder="Search OpenRouter models"
                  />
                  <select
                    value={settings.HERMES_MODEL}
                    onChange={(event) => patchSetting("HERMES_MODEL", event.target.value)}
                    className="h-11 w-full rounded-lg border border-[#26221C]/15 bg-white px-3 text-sm text-[#26221C] outline-none focus:border-[#C6A15B]"
                    disabled={modelsLoading}
                  >
                    {settings.HERMES_MODEL && !filteredModels.some((model) => model.id === settings.HERMES_MODEL) && (
                      <option value={settings.HERMES_MODEL}>{settings.HERMES_MODEL} — current selection</option>
                    )}
                    {filteredModels.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name} — {model.free ? "FREE" : "PAID"}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-[#26221C]/45">
                    {modelsLoading
                      ? "Loading the live OpenRouter catalog…"
                      : `${filteredModels.length} current ${modelFilter === "all" ? "" : modelFilter} OpenRouter models available.`}
                  </p>
                  {selectedOpenRouterModel && (
                    <p className={`rounded-lg px-3 py-2 text-xs ${selectedOpenRouterModel.toolCalling ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
                      {selectedOpenRouterModel.toolCalling
                        ? "Agent tools supported: suitable for the complete Hermes workforce."
                        : "Chat-only model: selectable, but the green operational test may fail because this model does not advertise tool calling."}
                    </p>
                  )}
                </div>
                  </Field>
                </>
              ) : (
                <>
                  <Field label="Ollama Machine URL">
                    <Input
                      value={settings.OLLAMA_BASE_URL}
                      onChange={(event) => patchSetting("OLLAMA_BASE_URL", event.target.value)}
                      placeholder="http://host.docker.internal:11434/v1"
                    />
                  </Field>
                  <Button variant="outline" className="w-full" onClick={() => void syncOllamaModels()} disabled={ollamaLoading}>
                    <RefreshCw className={`h-4 w-4 ${ollamaLoading ? "animate-spin" : ""}`} />
                    {ollamaLoading ? "Syncing machine" : "Sync installed Ollama models"}
                  </Button>
                  <Field label="Installed Ollama Model">
                    <select
                      value={settings.OLLAMA_MODEL}
                      onChange={(event) => patchSetting("OLLAMA_MODEL", event.target.value)}
                      className="h-11 w-full rounded-lg border border-[#26221C]/15 bg-white px-3 text-sm text-[#26221C] outline-none focus:border-[#C6A15B]"
                    >
                      {!ollamaModels.length && <option value={settings.OLLAMA_MODEL}>{settings.OLLAMA_MODEL || "Sync a machine to choose a model"}</option>}
                      {ollamaModels.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
                    </select>
                  </Field>
                  <p className="text-xs leading-relaxed text-[#26221C]/45">Hermes connects to Ollama through the machine address and uses a 64K agent context.</p>
                </>
              )}
            </div>

            <div className="space-y-4 rounded-xl border border-[#26221C]/10 p-5">
              <div className="flex items-center gap-2 font-medium text-[#26221C]"><Database className="h-4 w-4 text-[#C6A15B]" /> Resort Data</div>
              <Field label="Supabase Project URL">
                <Input value={settings.SUPABASE_URL} onChange={(e) => patchSetting("SUPABASE_URL", e.target.value)} placeholder="https://project.supabase.co" />
              </Field>
              <Field label="Supabase Service Role Key">
                <Input type={showSecrets ? "text" : "password"} value={settings.SUPABASE_SERVICE_ROLE_KEY} onChange={(e) => patchSetting("SUPABASE_SERVICE_ROLE_KEY", e.target.value)} placeholder="Leave blank to keep the saved key" />
              </Field>
              {secretsSet.SUPABASE_SERVICE_ROLE_KEY && <p className="-mt-3 text-xs text-emerald-700">Service key saved privately</p>}
              <Field label="Resort Data Key">
                <Input value={settings.RESORT_CMS_KEY} onChange={(e) => patchSetting("RESORT_CMS_KEY", e.target.value)} />
              </Field>
            </div>

            <div className="space-y-4 rounded-xl border border-[#26221C]/10 p-5">
              <div className="flex items-center gap-2 font-medium text-[#26221C]"><Github className="h-4 w-4 text-[#C6A15B]" /> Developer Agent</div>
              <Field label="GitHub Repository">
                <Input value={settings.TALA_GITHUB_REPOSITORY} onChange={(e) => patchSetting("TALA_GITHUB_REPOSITORY", e.target.value)} placeholder="owner/repository" />
              </Field>
              <Field label="GitHub Fine-Grained Token">
                <Input type={showSecrets ? "text" : "password"} value={settings.GITHUB_TOKEN} onChange={(e) => patchSetting("GITHUB_TOKEN", e.target.value)} placeholder="Leave blank to keep the saved token" />
              </Field>
              {secretsSet.GITHUB_TOKEN && <p className="-mt-3 text-xs text-emerald-700">GitHub token saved privately</p>}
            </div>

            <div className="space-y-4 rounded-xl border border-[#26221C]/10 p-5">
              <div className="flex items-center gap-2 font-medium text-[#26221C]"><Mail className="h-4 w-4 text-[#C6A15B]" /> Email Agent</div>
              <Field label="Resend API Key">
                <Input type={showSecrets ? "text" : "password"} value={settings.RESEND_API_KEY} onChange={(e) => patchSetting("RESEND_API_KEY", e.target.value)} placeholder="Leave blank to keep the saved key" />
              </Field>
              {secretsSet.RESEND_API_KEY && <p className="-mt-3 text-xs text-emerald-700">Resend key saved privately</p>}
              <Field label="From Email Address">
                <Input type="email" value={settings.RESEND_FROM_EMAIL} onChange={(e) => patchSetting("RESEND_FROM_EMAIL", e.target.value)} placeholder="reservations@yourresort.com" />
              </Field>
            </div>
          </div>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#26221C]/10 pt-5">
            <p className="text-xs text-[#26221C]/45">Saving restarts the real Hermes gateway with the new private configuration.</p>
            <Button
              onClick={() => void saveConfiguration()}
              disabled={!ownerToken || savingSettings || verifying || (settings.AI_PROVIDER === "ollama" ? !settings.OLLAMA_MODEL : !settings.HERMES_MODEL)}
            >
              {savingSettings || verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {!ownerToken ? "Sign in to save settings" : verifying ? "Testing Hermes" : "Save, start and verify Hermes"}
            </Button>
          </div>
        </Card>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        {([
          ["Hermes", "hermes", status?.hermes ?? false],
          [settings.AI_PROVIDER === "ollama" ? "Ollama" : "OpenRouter", "openrouter", status?.openrouter ?? false],
          ["Resort data", "supabase", status?.supabase ?? false],
          ["Email", "email", status?.email ?? false],
          ["GitHub", "github", status?.github ?? false],
        ] as Array<[string, keyof ConnectionStatus, boolean]>).map(([label, checkKey, connected]) => {
          const detail = verification?.checks[checkKey]?.detail;
          return (
          <div key={label} className="rounded-xl border border-[#26221C]/10 bg-white px-4 py-3">
            <div className="flex items-center gap-2">
              {connected ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <XCircle className="h-4 w-4 text-[#26221C]/25" />
              )}
              <span className="text-sm font-medium text-[#26221C]">{label}</span>
            </div>
            <p className="mt-1 text-xs text-[#26221C]/45">{detail || connectionLabel(connected)}</p>
          </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-2">
          {AGENTS.map((agent) => {
            const Icon = agent.icon;
            const active = agent.id === agentId;
            return (
              <button
                key={agent.id}
                onClick={() => changeAgent(agent.id)}
                className={`w-full rounded-xl border p-4 text-left transition ${
                  active
                    ? "border-[#C6A15B] bg-[#C6A15B]/10"
                    : "border-[#26221C]/10 bg-white hover:border-[#C6A15B]/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${active ? "bg-[#C6A15B] text-white" : "bg-[#26221C]/5 text-[#26221C]/60"}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#26221C]">{agent.name}</p>
                    <p className="mt-0.5 text-[11px] text-[#26221C]/45">{operational ? "Ready for work" : "Setup required"}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-[#26221C]/55">{agent.duty}</p>
              </button>
            );
          })}
        </aside>

        <section className="flex min-h-[650px] flex-col overflow-hidden rounded-2xl border border-[#26221C]/10 bg-white shadow-sm">
          <header className="flex items-center justify-between border-b border-[#26221C]/10 px-5 py-4">
            <div>
              <h2 className="font-serif text-xl text-[#26221C]">{selected.name}</h2>
              <p className="text-xs text-[#26221C]/45">{selected.duty}</p>
            </div>
            <div className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${operational ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
              <Activity className="h-3.5 w-3.5" /> {operational ? "Active" : "Not ready"}
            </div>
          </header>

          <div className="flex-1 space-y-4 overflow-y-auto bg-[#FAF8F3] p-5">
            {messages.length === 0 && (
              <div className="mx-auto mt-16 max-w-lg text-center">
                <SelectedIcon className="mx-auto h-9 w-9 text-[#C6A15B]" />
                <h3 className="mt-4 font-serif text-xl text-[#26221C]">Give this agent real work</h3>
                <p className="mt-2 text-sm text-[#26221C]/50">{selected.duty}</p>
                <button
                  onClick={() => void sendMessage(selected.prompt)}
                  className="mt-5 rounded-xl border border-[#C6A15B]/40 bg-white px-4 py-3 text-left text-sm text-[#26221C] transition hover:border-[#C6A15B]"
                >
                  “{selected.prompt}”
                </button>
              </div>
            )}
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  message.role === "user"
                    ? "ml-auto bg-[#1F3D2B] text-white"
                    : "border border-[#26221C]/10 bg-white text-[#26221C]"
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            ))}
            {working && (
              <div className="flex w-fit items-center gap-2 rounded-2xl border border-[#26221C]/10 bg-white px-4 py-3 text-sm text-[#26221C]/55">
                <Loader2 className="h-4 w-4 animate-spin" /> Hermes is working…
              </div>
            )}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>

          <footer className="border-t border-[#26221C]/10 bg-white p-4">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) void sendMessage();
                }}
                placeholder={`Give ${selected.name} a task…`}
                disabled={working || !operational}
              />
              <Button onClick={() => void sendMessage()} disabled={working || !operational || !input.trim()}>
                {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-[#26221C]/40">
              <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Protected actions require approval</span>
              <span className="flex items-center gap-1"><BarChart3 className="h-3.5 w-3.5" /> Uses live resort data</span>
              <button
                className="ml-auto flex items-center gap-1 hover:text-[#26221C]"
                onClick={() => {
                  sessionStorage.removeItem(ACCESS_KEY_STORAGE);
                  localStorage.removeItem(RUNTIME_URL_STORAGE);
                  setAccessKey("");
                  setRuntimeUrl("");
                  setRuntimeUrlInput("");
                  setStatus(null);
                }}
              >
                <Settings2 className="h-3.5 w-3.5" /> Change Hermes server
              </button>
            </div>
          </footer>
        </section>
      </div>
    </div>
  );
}
