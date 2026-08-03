import { useMemo, useState } from "react";
import { Search, MessageCircle, Reply, CheckCircle, Trash2 } from "lucide-react";
import { useCms } from "@/context/CmsContext";
import { useToast } from "@/context/ToastContext";
import { Button, Field, Textarea } from "@/components/ui";
import { PageHeader, EmptyState } from "../shared/PageHeader";
import { OpsTable, OpsTH, OpsTD, StatusPill, KpiCard } from "../ops/OpsPrimitives";
import { formatDate, textSearch } from "../ops/opsUtils";
import type { GuestMessage } from "@/types/cms";

export default function MessagesManager() {
  const { data, update } = useCms();
  const { notify } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<GuestMessage["status"] | "all">("all");
  const [replyingTo, setReplyingTo] = useState<GuestMessage | null>(null);
  const [replyText, setReplyText] = useState("");

  const messages = data.operations.guestMessages;

  const filtered = useMemo(() => {
    let list = textSearch(messages, search, ["guestName", "guestPhone", "message"]);
    if (statusFilter !== "all") list = list.filter((m) => m.status === statusFilter);
    return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [messages, search, statusFilter]);

  const unreadCount = messages.filter((m) => m.status === "unread").length;
  const repliedCount = messages.filter((m) => m.status === "replied").length;
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = messages.filter((m) => m.createdAt.slice(0, 10) === today).length;

  const markRead = (id: string) => {
    update((d) => ({
      ...d,
      operations: {
        ...d.operations,
        guestMessages: d.operations.guestMessages.map((m) =>
          m.id === id ? { ...m, status: "read" as const } : m,
        ),
      },
    }));
  };

  const sendReply = () => {
    if (!replyingTo || !replyText.trim()) return;
    update((d) => ({
      ...d,
      operations: {
        ...d.operations,
        guestMessages: d.operations.guestMessages.map((m) =>
          m.id === replyingTo.id
            ? { ...m, reply: replyText.trim(), status: "replied" as const, repliedAt: new Date().toISOString() }
            : m,
        ),
      },
    }));
    notify("Reply sent");
    setReplyingTo(null);
    setReplyText("");
  };

  const removeMessage = (m: GuestMessage) => {
    if (!window.confirm("Delete this message?")) return;
    update((d) => ({
      ...d,
      operations: {
        ...d.operations,
        guestMessages: d.operations.guestMessages.filter((x) => x.id !== m.id),
      },
    }));
    notify("Message deleted");
  };

  return (
    <div>
      <PageHeader
        title="Guest Messages"
        description="Messages from guests via the Guest Portal"
      />

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <KpiCard label="Unread" value={String(unreadCount)} tone={unreadCount > 0 ? "warning" : "default"} />
        <KpiCard label="Replied" value={String(repliedCount)} tone="positive" />
        <KpiCard label="Today" value={String(todayCount)} />
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#26221C]/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search messages..."
            className="w-full rounded-lg border border-[#26221C]/10 bg-white py-2.5 pl-10 pr-4 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="rounded-lg border border-[#26221C]/10 bg-white px-3 py-2.5 text-sm"
        >
          <option value="all">All</option>
          <option value="unread">Unread</option>
          <option value="read">Read</option>
          <option value="replied">Replied</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No messages yet" description="Guest messages from the portal will appear here." />
      ) : (
        <div className="space-y-3">
          {filtered.map((msg) => (
            <div
              key={msg.id}
              className="rounded-xl border bg-white p-5"
              style={{ borderColor: msg.status === "unread" ? "#C6A15B" : "#26221C10" }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{msg.guestName}</p>
                  <p className="text-xs text-[#26221C]/40">{msg.guestPhone}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill value={msg.status} />
                  <span className="text-xs text-[#26221C]/30">{formatDate(msg.createdAt)}</span>
                </div>
              </div>

              <p className="mt-3 text-sm">{msg.message}</p>

              {msg.reply && (
                <div className="mt-3 rounded-lg bg-[#C6A15B]/5 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-[#26221C]/40">Staff reply</p>
                  <p className="mt-1 text-sm">{msg.reply}</p>
                </div>
              )}

              <div className="mt-3 flex gap-2">
                {msg.status === "unread" && (
                  <Button variant="outline" onClick={() => markRead(msg.id)}>
                    Mark Read
                  </Button>
                )}
                {!msg.reply && (
                  <Button onClick={() => { setReplyingTo(msg); setReplyText(""); }}>
                    <Reply className="mr-1 h-3.5 w-3.5" /> Reply
                  </Button>
                )}
                <button onClick={() => removeMessage(msg)} className="ml-auto text-[#26221C]/30 hover:text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reply Modal */}
      {replyingTo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-semibold">Reply to {replyingTo.guestName}</h3>
            <p className="mb-4 text-sm text-[#26221C]/60">"{replyingTo.message}"</p>
            <Field label="Your reply">
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your reply..."
                rows={3}
              />
            </Field>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReplyingTo(null)}>Cancel</Button>
              <Button onClick={sendReply} disabled={!replyText.trim()}>Send Reply</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
