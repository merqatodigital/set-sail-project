import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Bot,
  CheckCircle2,
  CircleDollarSign,
  Code2,
  Database,
  Inbox,
  Laptop,
  Loader2,
  Mail,
  Megaphone,
  RefreshCw,
  Save,
  Send,
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
type CheckId = "hermes" | "openrouter" | "supabase" | "email" | "github" | "ollama";
type Check = { ok: boolean; detail: string };
type Verification = {
  state: "not_run" | "ready" | "failed";
  ready: boolean;
  checks: Partial<Record<CheckId, Check>>;
  counts?: Record<string, number> | null;
  model?: string;
  checkedAt: number | null;
};

type OpenRouterModel = {
  id: string;
  name: string;
  free: boolean;
  contextLength: number;
  toolCalling: boolean;
};

type HermesSettings = {
  provider: string;
  openrouter_model: string;
  ollama_base_url: string;
  ollama_model: string;
  resort_cms_key: string;
  github_repository: string;
  resend_from_email: string;
};

type Handoff = {
  id: string;
  title: string;
  due: string;
  status: string;
  category: string;
  agent: AgentId;
  created_at: string;
};

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hermes`;

const DEFAULT_SETTINGS: HermesSettings = {
  provider: "openrouter",
  openrouter_model: "openai/gpt-oss-20b:free",
  ollama_base_url: "",
  ollama_model: "",
  resort_cms_key: "marina_terrace_payload",
  github_repository: "merqatodigital/set-sail-project",
  resend_from_email: "",
};

const AGENTS: Array<{ id: AgentId; name: string; duty: string; icon: typeof Bot; prompt: string }> = [
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
    duty: "Inspects the project, diagnoses problems and prepares fixes.",
    icon: Code2,
    prompt: "Report the most important technical risks in the resort website right now.",
  },
  {
    id: "operations",
    name: "Operations Agent",
    duty: "Coordinates bookings, tours, rentals, food, messages and staff tasks.",
    icon: Users,
    prompt: "Prepare today’s resort operations briefing and flag anything requiring attention.",
  },
];

const CHECK_LABELS: Array<{ id: CheckId; label: string; icon: typeof Bot }> = [
  { id: "hermes", label: "Hermes workforce", icon: ShieldCheck },
  { id: "openrouter", label: "Selected model", icon: Bot },
  { id: "supabase", label: "Resort data", icon: Database },
  { id: "email", label: "Email provider", icon: Mail },
  { id: "github", label: "Developer access", icon: Code2 },
  { id: "ollama", label: "Local Machine Connector", icon: Laptop },
];

function maskReportPhoneNumbers(content: string) {
  return content.replace(/\+?\d[\d\s().-]{7,}\d/g, (candidate) => {
    const digits = candidate.replace(/\D/g, "");
    return digits.length >= 8 ? `Phone ending ${digits.slice(-4)}` : candidate;
  });
}

function ReportContent({ content }: { content: string }) {
  const blocks: ReactNode[] = [];
  const lines = maskReportPhoneNumbers(content).split("\n");

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line || /^\|?\s*[-:]+(?:\s*\|\s*[-:]+)+\s*\|?$/.test(line)) return;
    const clean = line.replace(/\*\*/g, "");

    if (clean.startsWith("### ")) {
      blocks.push(<h4 key={index} className="pt-2 text-sm font-semibold text-[#5E431A]">{clean.slice(4)}</h4>);
    } else if (clean.startsWith("## ")) {
      blocks.push(<h3 key={index} className="pt-3 text-base font-semibold text-[#26221C]">{clean.slice(3)}</h3>);
    } else if (clean.startsWith("# ")) {
      blocks.push(<h2 key={index} className="pt-3 font-serif text-xl text-[#26221C]">{clean.slice(2)}</h2>);
    } else if (clean.startsWith("|")) {
      const cells = clean.split("|").slice(1, -1).map((cell) => cell.trim());
      blocks.push(
        <div key={index} className="grid gap-2 rounded-lg border border-[#26221C]/10 bg-white/65 px-3 py-2 text-xs sm:grid-flow-col sm:auto-cols-fr">
          {cells.map((cell, cellIndex) => <span key={cellIndex} className="break-words">{cell}</span>)}
        </div>,
      );
    } else if (/^[-*]\s+/.test(clean)) {
      blocks.push(<p key={index} className="pl-4 text-sm before:mr-2 before:text-[#C6A15B] before:content-['•']">{clean.replace(/^[-*]\s+/, "")}</p>);
    } else if (/^>\s?/.test(clean)) {
      blocks.push(<p key={index} className="border-l-2 border-[#C6A15B]/60 pl-3 text-sm italic">{clean.replace(/^>\s?/, "")}</p>);
    } else {
      blocks.push(<p key={index} className="text-sm">{clean}</p>);
    }
  });

  return <div className="space-y-2">{blocks}</div>;
}

export default function HermesWorkforce() {
  const [agentId, setAgentId] = useState<AgentId>("supervisor");
  const [settings, setSettings] = useState<HermesSettings>(DEFAULT_SETTINGS);
  const [secretsSet, setSecretsSet] = useState<Record<string, boolean>>({});
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelFilter, setModelFilter] = useState<"all" | "free" | "paid">("free");
  const [modelSearch, setModelSearch] = useState("");
  const [verification, setVerification] = useState<Verification | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [working, setWorking] = useState(false);
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [handoffBusy, setHandoffBusy] = useState("");
  const [error, setError] = useState("");
  const [ownerToken, setOwnerToken] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [signInEmail, setSignInEmail] = useState("");
  const [signInBusy, setSignInBusy] = useState(false);
  const [signInMessage, setSignInMessage] = useState("");
  const tokenRef = useRef("");

  const selected = useMemo(() => AGENTS.find((agent) => agent.id === agentId)!, [agentId]);
  const SelectedIcon = selected.icon;
  const operational = verification?.ready === true;
  const activeHandoffs = useMemo(
    () => handoffs.filter((handoff) => !["done", "completed", "cancelled"].includes(handoff.status.toLowerCase())),
    [handoffs],
  );

  const filteredModels = useMemo(() => {
    const query = modelSearch.trim().toLowerCase();
    return models.filter((model) => {
      if (modelFilter === "free" && !model.free) return false;
      if (modelFilter === "paid" && model.free) return false;
      return !query || model.name.toLowerCase().includes(query) || model.id.toLowerCase().includes(query);
    });
  }, [modelFilter, modelSearch, models]);

  const call = async (path: string, init: RequestInit = {}) => {
    const token = tokenRef.current;
    if (!token) throw new Error("Sign in as the resort owner to use Hermes.");
    const response = await fetch(`${FUNCTIONS_BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers || {}) },
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || `Hermes request failed (${response.status}).`);
    return data as any;
  };

  const loadSettings = async () => {
    try {
      const data = await call("/settings");
      setSettings((current) => ({ ...current, ...data.settings }));
      setSecretsSet(data.secretsSet || {});
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load Hermes settings.");
    }
  };

  const loadModels = async () => {
    if (modelsLoading) return;
    setModelsLoading(true);
    try {
      const data = await call("/models");
      setModels(Array.isArray(data.models) ? data.models : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load the OpenRouter catalog.");
    } finally {
      setModelsLoading(false);
    }
  };

  const loadHandoffs = async () => {
    try {
      const data = await call("/handoffs");
      setHandoffs(Array.isArray(data.handoffs) ? data.handoffs : []);
    } catch {
      setHandoffs([]);
    }
  };

  const verify = async () => {
    if (verifying) return false;
    setVerifying(true);
    setError("");
    try {
      const data = await call("/verify", { method: "POST", body: "{}" });
      setVerification(data as Verification);
      if (!data.ready) setError("Hermes is not fully operational yet — review the connection cards below.");
      return Boolean(data.ready);
    } catch (reason) {
      setVerification({ state: "failed", ready: false, checks: {}, checkedAt: null });
      setError(reason instanceof Error ? reason.message : "Hermes verification failed.");
      return false;
    } finally {
      setVerifying(false);
    }
  };

  const saveSettings = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const data = await call("/settings", {
        method: "PUT",
        body: JSON.stringify({
          provider: "openrouter",
          openrouter_model: settings.openrouter_model,
          resort_cms_key: settings.resort_cms_key,
          github_repository: settings.github_repository,
          resend_from_email: settings.resend_from_email,
        }),
      });
      if (data.settings) setSettings((current) => ({ ...current, ...data.settings }));
      await verify();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save Hermes settings.");
    } finally {
      setSaving(false);
    }
  };

  const runAgent = async (task: string) => {
    const text = task.trim();
    if (!text || working) return;
    setWorking(true);
    setError("");
    setMessages((current) => [...current, { role: "user", content: text }]);
    try {
      const data = await call("/run", {
        method: "POST",
        body: JSON.stringify({ agent: agentId, task: text, messages: messages.slice(-10) }),
      });
      setMessages((current) => [...current, { role: "assistant", content: String(data.reply || "") }]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Hermes could not complete that task.");
    } finally {
      setWorking(false);
    }
  };

  const runHandoff = async (taskId: string) => {
    if (handoffBusy) return;
    setHandoffBusy(taskId);
    setError("");
    try {
      const data = await call("/handoff", { method: "POST", body: JSON.stringify({ taskId }) });
      setAgentId(data.agent as AgentId);
      setMessages((current) => [
        ...current,
        { role: "user", content: `TALA handoff ${taskId}` },
        { role: "assistant", content: String(data.reply || "") },
      ]);
      await loadHandoffs();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to run that TALA handoff.");
    } finally {
      setHandoffBusy("");
    }
  };

  const sendOwnerSignIn = async () => {
    const email = signInEmail.trim();
    if (!email || signInBusy) return;
    setSignInBusy(true);
    setSignInMessage("");
    try {
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.href },
      });
      if (signInError) throw signInError;
      setSignInMessage("Check your email and open the secure sign-in link to unlock Hermes.");
    } catch (reason) {
      setSignInMessage(reason instanceof Error ? reason.message : "Unable to send the sign-in link.");
    } finally {
      setSignInBusy(false);
    }
  };

  useEffect(() => {
    const apply = (token: string, email: string) => {
      tokenRef.current = token;
      setOwnerToken(token);
      setOwnerEmail(email);
      if (token) {
        void loadSettings();
        void loadModels();
        void loadHandoffs();
      }
    };
    void supabase.auth.getSession().then(({ data }) => {
      apply(data.session?.access_token || "", data.session?.user.email || "");
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      apply(session?.access_token || "", session?.user.email || "");
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (!ownerToken) {
    return (
      <div>
        <PageHeader title="Hermes Workforce" description="Private back-office AI team for the resort owner." />
        <Card className="max-w-xl space-y-4 border-[#C6A15B]/35 p-6">
          <div className="flex items-center gap-2 font-medium text-[#26221C]">
            <ShieldCheck className="h-4 w-4 text-[#C6A15B]" /> Owner sign-in required
          </div>
          <p className="text-sm leading-relaxed text-[#26221C]/60">
            Hermes runs on the resort’s private backend. Sign in with the owner email registered for this resort.
          </p>
          <Field label="Owner email">
            <Input value={signInEmail} onChange={(event) => setSignInEmail(event.target.value)} placeholder="owner@resort.com" />
          </Field>
          <Button onClick={() => void sendOwnerSignIn()} disabled={signInBusy}>
            {signInBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send secure sign-in link
          </Button>
          {signInMessage && <p className="text-sm text-[#26221C]/60">{signInMessage}</p>}
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Hermes Workforce"
        description={`Private back-office AI team — signed in as ${ownerEmail}.`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void verify()} disabled={verifying}>
              {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Test connections
            </Button>
          </div>
        }
      />

      <div
        className={`mb-6 flex items-start gap-3 rounded-2xl border px-5 py-4 ${
          operational ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-950"
        }`}
      >
        {operational ? (
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
        ) : verifying ? (
          <Loader2 className="mt-0.5 h-6 w-6 shrink-0 animate-spin text-amber-700" />
        ) : (
          <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-amber-700" />
        )}
        <div>
          <p className="font-semibold">
            {operational ? "Hermes is operational" : verifying ? "Testing Hermes end to end" : "Hermes has not passed a live test yet"}
          </p>
          <p className="mt-1 text-sm opacity-75">
            {operational
              ? `${verification?.model} answered a live test and real resort data was read.`
              : "A green light appears only after the selected model answers live and real resort data is read."}
          </p>
        </div>
      </div>

      {error && <p className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CHECK_LABELS.map(({ id, label, icon: Icon }) => {
          const check = verification?.checks?.[id];
          const ok = Boolean(check?.ok);
          return (
            <Card key={id} className={`p-4 ${ok ? "border-emerald-200" : "border-[#26221C]/10"}`}>
              <div className="flex items-center gap-2 text-sm font-medium text-[#26221C]">
                <Icon className="h-4 w-4 text-[#C6A15B]" /> {label}
                {ok ? (
                  <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-600" />
                ) : (
                  <XCircle className="ml-auto h-4 w-4 text-[#26221C]/25" />
                )}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-[#26221C]/55">
                {check?.detail || "Run “Test connections” to check this live."}
              </p>
            </Card>
          );
        })}
      </div>

      <Card className="mb-6 space-y-6 border-[#C6A15B]/35 p-6">
        <div>
          <h2 className="font-serif text-2xl text-[#26221C]">Hermes Setup</h2>
          <p className="mt-1 text-sm text-[#26221C]/55">
            Hermes runs on the resort’s own private backend. Keys stay in backend secrets and never reach this page.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4 rounded-xl border border-[#26221C]/10 p-5">
            <div className="flex items-center gap-2 font-medium text-[#26221C]">
              <Bot className="h-4 w-4 text-[#C6A15B]" /> OpenRouter model
            </div>
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
            <Input value={modelSearch} onChange={(event) => setModelSearch(event.target.value)} placeholder="Search OpenRouter models" />
            <select
              value={settings.openrouter_model}
              onChange={(event) => setSettings((current) => ({ ...current, openrouter_model: event.target.value }))}
              className="h-11 w-full rounded-lg border border-[#26221C]/15 bg-white px-3 text-sm text-[#26221C] outline-none focus:border-[#C6A15B]"
              disabled={modelsLoading}
              aria-label="OpenRouter model"
            >
              {settings.openrouter_model && !filteredModels.some((model) => model.id === settings.openrouter_model) && (
                <option value={settings.openrouter_model}>{settings.openrouter_model} — current selection</option>
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
                : `${filteredModels.length} ${modelFilter === "all" ? "" : modelFilter} models available.`}
            </p>
            <p className={`text-xs ${secretsSet.OPENROUTER_API_KEY ? "text-emerald-700" : "text-amber-700"}`}>
              {secretsSet.OPENROUTER_API_KEY
                ? "OpenRouter key is stored in the private backend secrets."
                : "The OpenRouter key is missing from the backend secrets."}
            </p>
          </div>

          <div className="space-y-4 rounded-xl border border-[#26221C]/10 p-5">
            <div className="flex items-center gap-2 font-medium text-[#26221C]">
              <Database className="h-4 w-4 text-[#C6A15B]" /> Resort data & optional access
            </div>
            <Field label="Resort content key" hint="Which resort content record Hermes reads.">
              <Input
                value={settings.resort_cms_key}
                onChange={(event) => setSettings((current) => ({ ...current, resort_cms_key: event.target.value }))}
              />
            </Field>
            <Field label="Developer repository" hint="Read-only until a developer token is added to backend secrets.">
              <Input
                value={settings.github_repository}
                onChange={(event) => setSettings((current) => ({ ...current, github_repository: event.target.value }))}
              />
            </Field>
            <Field label="Email from-address" hint="Email Agent drafts only until an email provider is connected.">
              <Input
                value={settings.resend_from_email}
                onChange={(event) => setSettings((current) => ({ ...current, resend_from_email: event.target.value }))}
                placeholder="frontdesk@resort.com"
              />
            </Field>
          </div>
        </div>

        <div className="rounded-xl border border-dashed border-[#26221C]/15 bg-[#26221C]/[0.03] p-5">
          <div className="flex items-center gap-2 font-medium text-[#26221C]/70">
            <Laptop className="h-4 w-4" /> Local Machine Connector (Ollama) — coming soon
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[#26221C]/50">
            Running Hermes on your own machine stays on the roadmap. It is disabled until the local connector is built, and it does
            not affect the OpenRouter workforce above.
          </p>
          <Button variant="outline" size="sm" className="mt-3" disabled>
            Connect a local machine
          </Button>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => void saveSettings()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save and test Hermes
          </Button>
          <Button variant="outline" onClick={() => void verify()} disabled={verifying}>
            {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Run live test only
          </Button>
        </div>
      </Card>

      <Card className="mb-6 space-y-3 p-6">
        <div className="flex items-center gap-2 font-medium text-[#26221C]">
          <Inbox className="h-4 w-4 text-[#C6A15B]" /> TALA handoffs
          <button type="button" onClick={() => void loadHandoffs()} className="ml-auto text-xs text-[#8A6B32]">
            Refresh
          </button>
        </div>
        {!activeHandoffs.length && (
          <p className="text-sm text-[#26221C]/50">
            No open handoffs. TALA sends back-office work here by creating a task in a “hermes” category.
          </p>
        )}
        {activeHandoffs.map((handoff) => (
          <div key={handoff.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[#26221C]/10 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[#26221C]">{handoff.title}</p>
              <p className="text-xs text-[#26221C]/50">
                {handoff.category} → {handoff.agent} · {handoff.status}
                {handoff.due ? ` · due ${handoff.due}` : ""}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => void runHandoff(handoff.id)} disabled={handoffBusy === handoff.id}>
              {handoffBusy === handoff.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Run
            </Button>
          </div>
        ))}
      </Card>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-2">
          {AGENTS.map((agent) => {
            const Icon = agent.icon;
            const active = agent.id === agentId;
            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => {
                  setAgentId(agent.id);
                  setMessages([]);
                }}
                className={`w-full rounded-xl border px-4 py-3 text-left ${
                  active ? "border-[#C6A15B] bg-[#C6A15B]/10" : "border-[#26221C]/10 bg-white"
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-medium text-[#26221C]">
                  <Icon className="h-4 w-4 text-[#C6A15B]" /> {agent.name}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-[#26221C]/50">{agent.duty}</span>
              </button>
            );
          })}
        </div>

        <Card className="flex min-h-[420px] flex-col p-6">
          <div className="flex items-center gap-2 border-b border-[#26221C]/10 pb-4 font-medium text-[#26221C]">
            <SelectedIcon className="h-4 w-4 text-[#C6A15B]" /> {selected.name}
            <span className="ml-auto rounded-full bg-[#C6A15B]/15 px-2.5 py-1 text-xs font-medium text-[#76541C]">Drafts only</span>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto py-4">
            {!messages.length && (
              <div className="space-y-3">
                <p className="text-sm text-[#26221C]/55">{selected.duty}</p>
                <Button variant="outline" size="sm" onClick={() => void runAgent(selected.prompt)} disabled={working}>
                  {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {selected.prompt}
                </Button>
              </div>
            )}
            {messages.map((message, index) => (
              <div
                key={index}
                className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
                  message.role === "user" ? "bg-[#26221C]/5 text-[#26221C]" : "bg-[#C6A15B]/10 text-[#26221C]"
                }`}
              >
                {message.role === "assistant" ? <ReportContent content={message.content} /> : <span className="whitespace-pre-wrap">{message.content}</span>}
              </div>
            ))}
            {working && (
              <p className="flex items-center gap-2 text-sm text-[#26221C]/50">
                <Loader2 className="h-4 w-4 animate-spin" /> {selected.name} is working…
              </p>
            )}
          </div>
          <p className="border-t border-[#26221C]/10 pt-3 text-xs leading-relaxed text-[#26221C]/50">
            Hermes prepares analysis and drafts. Sending email, changing reservations or prices, moving money, or pushing code needs your explicit approval.
          </p>
          <div className="flex gap-2 pt-3">
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  const task = input;
                  setInput("");
                  void runAgent(task);
                }
              }}
              placeholder={`Give ${selected.name} a task…`}
            />
            <Button
              onClick={() => {
                const task = input;
                setInput("");
                void runAgent(task);
              }}
              disabled={working || !input.trim()}
            >
              <Send className="h-4 w-4" /> Send
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
