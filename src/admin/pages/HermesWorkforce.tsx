import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  Bot,
  CheckCircle2,
  CircleDollarSign,
  Code2,
  KeyRound,
  Loader2,
  Mail,
  Megaphone,
  RefreshCw,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  XCircle,
} from "lucide-react";
import { Button, Input } from "@/components/ui";
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

const ACCESS_KEY_STORAGE = "hermes.workforceAccessKey";

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

function connectionLabel(value: boolean) {
  return value ? "Connected" : "Not connected";
}

export default function HermesWorkforce() {
  const [agentId, setAgentId] = useState<AgentId>("supervisor");
  const [accessKey, setAccessKey] = useState(readAccessKey);
  const [keyInput, setKeyInput] = useState(readAccessKey);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [error, setError] = useState("");
  const sessionRef = useRef(`admin:${crypto.randomUUID()}`);

  const selected = useMemo(() => AGENTS.find((agent) => agent.id === agentId)!, [agentId]);
  const SelectedIcon = selected.icon;

  const refreshStatus = async (key = accessKey) => {
    if (!key) return;
    setError("");
    try {
      const response = await fetch("/api/hermes/status", {
        headers: { "X-Hermes-Workforce-Key": key },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Unable to reach Hermes.");
      setStatus(data.connections as ConnectionStatus);
    } catch (reason) {
      setStatus(null);
      setError(reason instanceof Error ? reason.message : "Unable to reach Hermes.");
    }
  };

  useEffect(() => {
    if (accessKey) void refreshStatus(accessKey);
  }, [accessKey]);

  const unlock = () => {
    const value = keyInput.trim();
    if (!value) return;
    sessionStorage.setItem(ACCESS_KEY_STORAGE, value);
    setAccessKey(value);
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
        headers: {
          "Content-Type": "application/json",
          "X-Hermes-Workforce-Key": accessKey,
          "X-Hermes-Session": sessionRef.current,
        },
        body: JSON.stringify({ agent: agentId, messages: nextMessages }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Hermes could not complete the task.");
      setMessages((current) => [...current, { role: "assistant", content: data.reply }]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Hermes could not complete the task.");
    } finally {
      setWorking(false);
    }
  };

  if (!accessKey) {
    return (
      <div>
        <PageHeader
          title="Hermes Workforce"
          description="The private back-office AI workforce for resort management."
        />
        <div className="mx-auto max-w-lg rounded-2xl border border-[#26221C]/10 bg-white p-8 shadow-sm">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#C6A15B]/15">
            <KeyRound className="h-5 w-5 text-[#8A6B32]" />
          </div>
          <h2 className="font-serif text-2xl text-[#26221C]">Unlock the workforce</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#26221C]/55">
            Enter the private workforce access key configured on the resort server. It is kept only
            for this browser session and is never saved to the website CMS.
          </p>
          <div className="mt-6 flex gap-2">
            <Input
              type="password"
              value={keyInput}
              onChange={(event) => setKeyInput(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && unlock()}
              placeholder="Workforce access key"
            />
            <Button onClick={unlock}>Continue</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Hermes Workforce"
        description="One supervisor and specialized agents using the resort’s existing data, tools and knowledge."
        actions={
          <Button variant="outline" size="sm" onClick={() => void refreshStatus()}>
            <RefreshCw className="h-4 w-4" /> Check connections
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        {([
          ["Hermes", status?.hermes ?? false],
          ["OpenRouter", status?.openrouter ?? false],
          ["Resort data", status?.supabase ?? false],
          ["Email", status?.email ?? false],
          ["GitHub", status?.github ?? false],
        ] as Array<[string, boolean]>).map(([label, connected]) => (
          <div key={label} className="rounded-xl border border-[#26221C]/10 bg-white px-4 py-3">
            <div className="flex items-center gap-2">
              {connected ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <XCircle className="h-4 w-4 text-[#26221C]/25" />
              )}
              <span className="text-sm font-medium text-[#26221C]">{label}</span>
            </div>
            <p className="mt-1 text-xs text-[#26221C]/45">{connectionLabel(connected)}</p>
          </div>
        ))}
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
                    <p className="mt-0.5 text-[11px] text-[#26221C]/45">Ready for work</p>
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
            <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              <Activity className="h-3.5 w-3.5" /> Active
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
                disabled={working}
              />
              <Button onClick={() => void sendMessage()} disabled={working || !input.trim()}>
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
                  setAccessKey("");
                  setStatus(null);
                }}
              >
                <Settings2 className="h-3.5 w-3.5" /> Change access key
              </button>
            </div>
          </footer>
        </section>
      </div>
    </div>
  );
}
