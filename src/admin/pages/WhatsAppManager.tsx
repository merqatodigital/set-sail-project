import { useState } from "react";
import {
  Plus,
  Trash2,
  Star,
  MessageCircle,
  Bot,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  Info,
  Send,
  Loader2,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { useCms } from "@/context/CmsContext";
import { useToast } from "@/context/ToastContext";
import { Button, Card, Field, Input, Textarea, Select, Switch, Badge } from "@/components/ui";
import { PageHeader } from "../shared/PageHeader";
import { buildWhatsAppLink, normalizeNumber } from "@/lib/whatsapp";
import { sendWhatsAppTemplate, sendWhatsAppText } from "@/lib/whatsappSend";
import type { WhatsAppSettings, WhatsAppNumber } from "@/types/cms";

export default function WhatsAppManager() {
  const { data, update } = useCms();
  const { notify } = useToast();
  const wa = data.settings.whatsapp;
  const [copied, setCopied] = useState(false);

  const patch = (fn: (d: WhatsAppSettings) => WhatsAppSettings) =>
    update((d) => ({ ...d, settings: { ...d.settings, whatsapp: fn(d.settings.whatsapp) } }));

  const patchChatbot = (patchObj: Partial<WhatsAppSettings["chatbot"]>) =>
    patch((d) => ({ ...d, chatbot: { ...d.chatbot, ...patchObj } }));

  const patchCloudApi = (patchObj: Partial<WhatsAppSettings["cloudApi"]>) =>
    patch((d) => ({ ...d, cloudApi: { ...d.cloudApi, ...patchObj } }));
  const patchCloudApiTemplates = (patchObj: Partial<WhatsAppSettings["cloudApi"]["templates"]>) =>
    patch((d) => ({
      ...d,
      cloudApi: { ...d.cloudApi, templates: { ...d.cloudApi.templates, ...patchObj } },
    }));

  // ---- Real send test (Cloud API) -----------------------------------------
  const [testNumber, setTestNumber] = useState("");
  const [testTemplate, setTestTemplate] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const sendTest = async () => {
    if (!testNumber.trim()) return;
    setTestSending(true);
    setTestResult(null);
    const result = testTemplate.trim()
      ? await sendWhatsAppTemplate(testNumber, testTemplate.trim(), wa.cloudApi.templateLanguage)
      : await sendWhatsAppText(
          testNumber,
          "This is a test message from TALA — WhatsApp Cloud API is connected.",
        );
    setTestSending(false);
    setTestResult(
      result.success
        ? { ok: true, message: "Sent! Check that number's WhatsApp." }
        : { ok: false, message: result.error || "Send failed." },
    );
  };

  // ---- Numbers CRUD -------------------------------------------------------
  const addNumber = () => {
    const newItem: WhatsAppNumber = {
      id: `wa_${Date.now()}`,
      label: "New Line",
      number: "",
      isPrimary: wa.numbers.length === 0,
    };
    patch((d) => ({ ...d, numbers: [...d.numbers, newItem] }));
    notify("WhatsApp number added");
  };

  const updateNumber = (id: string, updates: Partial<WhatsAppNumber>) => {
    patch((d) => ({
      ...d,
      numbers: d.numbers.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    }));
  };

  const removeNumber = (id: string) => {
    patch((d) => {
      const next = d.numbers.filter((n) => n.id !== id);
      // ensure one primary remains
      if (next.length > 0 && !next.some((n) => n.isPrimary)) next[0].isPrimary = true;
      return { ...d, numbers: next };
    });
    notify("WhatsApp number removed");
  };

  const setPrimary = (id: string) => {
    patch((d) => ({ ...d, numbers: d.numbers.map((n) => ({ ...n, isPrimary: n.id === id })) }));
    notify("Primary number updated");
  };

  // ---- Test link ----------------------------------------------------------
  const testLink = buildWhatsAppLink(wa, data.settings.contact);
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(testLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      notify("Could not copy link", "info");
    }
  };

  return (
    <div>
      <PageHeader
        title="WhatsApp"
        description="Central control for every WhatsApp button on the site. Update numbers and message templates here — the whole website updates instantly."
      />

      {/* ---- Numbers ---- */}
      <Card className="mb-6 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="font-serif text-lg text-[#26221C]">WhatsApp Numbers</p>
            <p className="mt-1 text-sm text-[#26221C]/55">
              Add one or more numbers. The <strong>Primary</strong> number is used across the site
              (nav, hero, pricing, footer, floating button).
            </p>
          </div>
          <Button size="sm" onClick={addNumber}>
            <Plus className="h-4 w-4" /> Add Number
          </Button>
        </div>

        <div className="space-y-3">
          {wa.numbers.map((n) => {
            const digits = normalizeNumber(n.number);
            const valid = digits.length >= 10;
            return (
              <div key={n.id} className="rounded-xl border border-[#26221C]/10 bg-[#FAF6EF] p-4">
                <div className="grid gap-3 md:grid-cols-[1fr_1.4fr_auto] md:items-end">
                  <Field label="Label" hint="e.g. Bookings, General, Kitchen">
                    <Input
                      value={n.label}
                      onChange={(e) => updateNumber(n.id, { label: e.target.value })}
                      onBlur={() => notify("Saved")}
                    />
                  </Field>
                  <Field label="Phone Number" hint="Include country code, e.g. +63 967 206 2327">
                    <Input
                      value={n.number}
                      onChange={(e) => updateNumber(n.id, { number: e.target.value })}
                      onBlur={() => notify("Saved")}
                      placeholder="+63 900 000 0000"
                      className={!valid && n.number ? "border-red-300" : ""}
                    />
                  </Field>
                  <div className="flex items-center gap-2 pb-1">
                    <button
                      onClick={() => setPrimary(n.id)}
                      className={`flex h-10 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium uppercase tracking-wide transition ${
                        n.isPrimary
                          ? "border-[#C6A15B] bg-[#C6A15B] text-[#221D14]"
                          : "border-[#26221C]/15 text-[#26221C]/60 hover:border-[#C6A15B]/40 hover:text-[#C6A15B]"
                      }`}
                    >
                      <Star className={`h-3.5 w-3.5 ${n.isPrimary ? "fill-current" : ""}`} />
                      {n.isPrimary ? "Primary" : "Set Primary"}
                    </button>
                    <button
                      onClick={() => removeNumber(n.id)}
                      disabled={wa.numbers.length <= 1}
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#26221C]/15 text-[#26221C]/40 transition hover:border-red-200 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
                      title={
                        wa.numbers.length <= 1 ? "At least one number is required" : "Delete number"
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {digits && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#26221C]/50">
                    <span>
                      Normalized: <code className="rounded bg-white px-1.5 py-0.5">{digits}</code>
                    </span>
                    <span className="text-[#26221C]/20">·</span>
                    <a
                      href={`https://wa.me/${digits}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[#8A6B32] hover:underline"
                    >
                      Test this number <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
            );
          })}
          {wa.numbers.length === 0 && (
            <p className="rounded-xl border border-dashed border-[#26221C]/15 bg-white/50 p-6 text-center text-sm text-[#26221C]/50">
              No numbers yet. Add your first WhatsApp number above.
            </p>
          )}
        </div>
      </Card>

      {/* ---- Message Templates ---- */}
      <Card className="mb-6 p-6">
        <div className="mb-4 flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-[#C6A15B]" />
          <p className="font-serif text-lg text-[#26221C]">Message Templates</p>
        </div>
        <p className="mb-5 text-sm text-[#26221C]/55">
          These messages are pre-filled when a visitor taps a WhatsApp button. Use{" "}
          <code className="rounded bg-[#26221C]/5 px-1.5 py-0.5 text-xs">{"{package}"}</code> in the
          booking template to auto-insert the package name.
        </p>
        <div className="space-y-4">
          <Field label="Default Message" hint="Used by the nav, hero, footer and floating button">
            <Textarea
              rows={2}
              value={wa.defaultMessage}
              onChange={(e) => patch((d) => ({ ...d, defaultMessage: e.target.value }))}
              onBlur={() => notify("Message template saved")}
            />
          </Field>
          <Field label="Booking Message" hint="Used from pricing package buttons">
            <Textarea
              rows={2}
              value={wa.bookingMessage}
              onChange={(e) => patch((d) => ({ ...d, bookingMessage: e.target.value }))}
              onBlur={() => notify("Message template saved")}
            />
          </Field>
          <Field label="Business Hours Note" hint="Shown in the WhatsApp panel/tooltip (optional)">
            <Input
              value={wa.businessHoursNote}
              onChange={(e) => patch((d) => ({ ...d, businessHoursNote: e.target.value }))}
              onBlur={() => notify("Saved")}
            />
          </Field>
        </div>
      </Card>

      {/* ---- Display Controls ---- */}
      <Card className="mb-6 p-6">
        <p className="mb-4 font-serif text-lg text-[#26221C]">Where WhatsApp Appears</p>
        <div className="space-y-3">
          <label className="flex items-center justify-between rounded-lg bg-[#FAF6EF] px-4 py-3">
            <div>
              <p className="text-sm font-medium text-[#26221C]">Floating WhatsApp Button</p>
              <p className="text-xs text-[#26221C]/50">Green circle bottom-right on every page.</p>
            </div>
            <Switch
              checked={wa.showFloatingButton}
              onChange={(v) => {
                patch((d) => ({ ...d, showFloatingButton: v }));
                notify(v ? "Floating button shown" : "Floating button hidden");
              }}
            />
          </label>
          <label className="flex items-center justify-between rounded-lg bg-[#FAF6EF] px-4 py-3">
            <div>
              <p className="text-sm font-medium text-[#26221C]">WhatsApp CTA in Navigation</p>
              <p className="text-xs text-[#26221C]/50">
                The top-right WhatsApp button in the navbar.
              </p>
            </div>
            <Switch
              checked={wa.showInNavbar}
              onChange={(v) => {
                patch((d) => ({ ...d, showInNavbar: v }));
                notify(v ? "Navbar CTA shown" : "Navbar CTA hidden");
              }}
            />
          </label>
        </div>
      </Card>

      {/* ---- Live Preview / Test Link ---- */}
      <Card className="mb-6 p-6">
        <p className="mb-3 font-serif text-lg text-[#26221C]">Live Test Link</p>
        <p className="mb-4 text-sm text-[#26221C]/55">
          This is the exact link every WhatsApp button on the site is opening right now.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <code
            className="flex-1 truncate rounded-lg border border-[#26221C]/10 bg-[#FAF6EF] px-3 py-2.5 text-xs text-[#26221C]/70"
            title={testLink}
          >
            {testLink || "No primary number set"}
          </code>
          <div className="flex gap-2">
            <Button variant="outline" size="md" onClick={copyLink}>
              {copied ? (
                <>
                  <Check className="h-4 w-4" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" /> Copy
                </>
              )}
            </Button>
            <a
              href={testLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#1EBE57]"
            >
              <MessageCircle className="h-4 w-4" /> Open
            </a>
          </div>
        </div>
      </Card>

      {/* ---- Cloud API — real sending, active now ---- */}
      <Card className="mb-6 p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#25D366]/15">
              <Send className="h-5 w-5 text-[#1EBE57]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-serif text-lg text-[#26221C]">
                  WhatsApp Cloud API — Real Sending
                </p>
                <Badge className="bg-green-100 text-green-700">
                  <CheckCircle2 className="mr-1 inline h-2.5 w-2.5" /> Active
                </Badge>
              </div>
              <p className="mt-1 max-w-2xl text-sm text-[#26221C]/55">
                Lets TALA and the admin console actually send WhatsApp messages — booking reminders,
                the daily brief, low-stock alerts — instead of only opening a link for you to send
                by hand.
              </p>
            </div>
          </div>
          <Switch
            checked={wa.cloudApi.enabled}
            onChange={(v) => {
              patchCloudApi({ enabled: v });
              notify(v ? "Real WhatsApp sending enabled" : "Real WhatsApp sending disabled");
            }}
          />
        </div>

        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900/80">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Your Twilio credentials are <strong>not</strong> entered here — this page is
            public-readable, like the rest of the site's content. Set them once as Supabase secrets
            (Edge Functions → Secrets):{" "}
            <code className="rounded bg-white px-1 py-0.5">TWILIO_ACCOUNT_SID</code> and{" "}
            <code className="rounded bg-white px-1 py-0.5">TWILIO_AUTH_TOKEN</code>, from your
            Twilio Console. Only the template IDs below (not secret) live in this page.
          </p>
        </div>

        <fieldset disabled={!wa.cloudApi.enabled} className="space-y-4 disabled:opacity-60">
          <Field label="Template Language" hint="For future use; not currently used by Twilio">
            <Input
              value={wa.cloudApi.templateLanguage}
              onChange={(e) => patchCloudApi({ templateLanguage: e.target.value })}
              onBlur={() => notify("Saved")}
              placeholder="en_US"
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-3">
            <Field
              label="Booking Reminder — Content SID"
              hint="From Twilio console, starts with HX"
            >
              <Input
                value={wa.cloudApi.templates.bookingReminder}
                onChange={(e) => patchCloudApiTemplates({ bookingReminder: e.target.value })}
                onBlur={() => notify("Saved")}
                placeholder="HXfda3c3d7e4dab5c1d9e2f3a4b5c6d7e8"
              />
            </Field>
            <Field label="Daily Brief — Content SID" hint="From Twilio console, starts with HX">
              <Input
                value={wa.cloudApi.templates.dailyBrief}
                onChange={(e) => patchCloudApiTemplates({ dailyBrief: e.target.value })}
                onBlur={() => notify("Saved")}
                placeholder="HX..."
              />
            </Field>
            <Field label="Low Stock Alert — Content SID" hint="From Twilio console, starts with HX">
              <Input
                value={wa.cloudApi.templates.lowStockAlert}
                onChange={(e) => patchCloudApiTemplates({ lowStockAlert: e.target.value })}
                onBlur={() => notify("Saved")}
                placeholder="HX..."
              />
            </Field>
          </div>

          <div className="rounded-lg border border-[#26221C]/10 bg-[#FAF6EF] p-4">
            <p className="mb-3 text-sm font-medium text-[#26221C]">Send a test message</p>
            <div className="grid gap-3 sm:grid-cols-[1.2fr_1fr_auto]">
              <Input
                value={testNumber}
                onChange={(e) => setTestNumber(e.target.value)}
                placeholder="+63 917 123 4567"
              />
              <Input
                value={testTemplate}
                onChange={(e) => setTestTemplate(e.target.value)}
                placeholder="Template name (leave blank for plain text)"
              />
              <Button onClick={sendTest} disabled={testSending || !testNumber.trim()}>
                {testSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send Test
              </Button>
            </div>
            <p className="mt-2 text-xs text-[#26221C]/50">
              Leave the template field blank to send plain text — that only works if this number has
              messaged you in the last 24 hours. To test cold outbound, use one of your approved
              template names above.
            </p>
            {testResult && (
              <p className={`mt-3 text-sm ${testResult.ok ? "text-green-700" : "text-red-600"}`}>
                {testResult.message}
              </p>
            )}
          </div>
        </fieldset>
      </Card>

      {/* ---- Chatbot (Coming Soon) ---- */}
      <Card className="p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#C6A15B]/15">
              <Bot className="h-5 w-5 text-[#C6A15B]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-serif text-lg text-[#26221C]">WhatsApp Chatbot</p>
                <Badge className="bg-blue-100 text-blue-700">
                  <Sparkles className="mr-1 inline h-2.5 w-2.5" /> Coming Soon
                </Badge>
              </div>
              <p className="mt-1 max-w-2xl text-sm text-[#26221C]/55">
                Future integration for automatic replies, booking flows and after-hours responses
                via the WhatsApp Business Cloud API or Twilio. Configure your credentials below now
                — activation will be enabled in a later release.
              </p>
            </div>
          </div>
          <Switch
            checked={wa.chatbot.enabled}
            onChange={(v) => {
              patchChatbot({ enabled: v });
              notify(v ? "Chatbot enabled (pending integration)" : "Chatbot disabled");
            }}
          />
        </div>

        <div className="mb-4 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-xs text-blue-900/80">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Your settings are stored securely and will activate automatically once the chatbot
            service is connected. No message will be sent until that time.
          </p>
        </div>

        <fieldset disabled={!wa.chatbot.enabled} className="space-y-4 disabled:opacity-60">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Provider">
              <Select
                value={wa.chatbot.provider}
                onChange={(e) =>
                  patchChatbot({
                    provider: e.target.value as WhatsAppSettings["chatbot"]["provider"],
                  })
                }
              >
                <option value="none">— Select —</option>
                <option value="whatsapp-cloud">WhatsApp Business Cloud API</option>
                <option value="twilio">Twilio</option>
                <option value="custom">Custom Webhook</option>
              </Select>
            </Field>
            <Field label="API Key / Access Token">
              <Input
                type="password"
                placeholder="••••••••••••"
                value={wa.chatbot.apiKey}
                onChange={(e) => patchChatbot({ apiKey: e.target.value })}
                onBlur={() => notify("Saved")}
              />
            </Field>
          </div>
          <Field label="Webhook URL" hint="Where incoming WhatsApp messages will be delivered">
            <Input
              value={wa.chatbot.webhookUrl}
              onChange={(e) => patchChatbot({ webhookUrl: e.target.value })}
              onBlur={() => notify("Saved")}
              placeholder="https://api.your-service.com/whatsapp"
            />
          </Field>
          <Field label="Auto-Reply Message" hint="Sent instantly to every new WhatsApp inquiry">
            <Textarea
              rows={2}
              value={wa.chatbot.autoReplyMessage}
              onChange={(e) => patchChatbot({ autoReplyMessage: e.target.value })}
              onBlur={() => notify("Saved")}
            />
          </Field>
        </fieldset>
      </Card>
    </div>
  );
}
