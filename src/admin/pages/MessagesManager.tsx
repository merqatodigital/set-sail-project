import { useMemo, useState } from "react";
import { Search, Reply, Trash2 } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { Button, Field, Textarea } from "@/components/ui";
import { PageHeader, EmptyState } from "../shared/PageHeader";
import { OpsTable, OpsTH, OpsTD, StatusPill, KpiCard } from "../ops/OpsPrimitives";
import { usePortalOps } from "../ops/usePortalOps";
import {
  markPortalMessageRead,
  replyPortalMessage,
  deletePortalGuestMessage,
} from "@/lib/portalAdminRepo";
import { formatDate, textSearch } from "../ops/opsUtils";
import type { PortalGuestMessageRow } from "@/lib/portalRepo";

type MessageStatus = "unread" | "read" | "replied";

export default function MessagesManager() {
  const { messages, refresh } = usePortalOps();
  const { notify } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<MessageStatus | "all">("all");
  const [replyingTo, setReplyingTo] = useState<PortalGuestMessageRow | null>(null);
  const [replyText, setReplyText] = useState("");

  const filtered = useMemo(() => {
    let list = textSearch(messages, search, ["guest_name", "guest_phone", "message"]);
    if (statusFilter !== "all") list = list.filter((m) => m.status === statusFilter);
    return [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [messages, search, statusFilter]);

  const unreadCount = messages.filter((m) => m.status === "unread").length;
  const repliedCount = messages.filter((m) => m.status === "replied").length;
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = messages.filter((m) => m.created_at.slice(0, 10) === today).length;

  const markRead = async (id: string) => {
    const ok = await markPortalMessageRead(id);
    if (!ok) return notify("Could not update message", "info");
    await refresh();
  };

  const sendReply = async () => {
    if (!replyingTo || !replyText.trim()) return;
    const ok = await replyPortalMessage(replyingTo.id, replyText.trim());
    if (!ok) return notify("Could not send reply", "info");
    await refresh();
    notify("Reply sent");
    setReplyingTo(null);
    setReplyText("");
  };

  const removeMessage = async (m: PortalGuestMessageRow) => {
    if (!window.confirm("Delete this message?")) return;
    const ok = await deletePortalGuestMessage(m.id);
    if (!ok) return notify("Could not delete message", "info");
    await refresh();
    notify("Message deleted");
  };

  return (
    <div>
      <PageHeader
        title="Guest Messages"
        description="Messages from guests via the Guest Portal — persisted in tala_guest_messages and shared with TALA."
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
          onChange={(e) => setStatusFilter(e.target.value as MessageStatus | "all")}
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
        <OpsTable>
          <thead>
            <tr>
              <OpsTH>Guest</OpsTH>
              <OpsTH>Message</OpsTH>
              <OpsTH>Reply</OpsTH>
              <OpsTH>Status</OpsTH>
              <OpsTH>Date</OpsTH>
              <OpsTH className="text-right">Actions</OpsTH>
            </tr>
          </thead>
          <tbody>
            {filtered.map((msg) => (
              <tr key={msg.id} className="border-t border-[#26221C]/5">
                <OpsTD>
                  <p className="font-medium">{msg.guest_name}</p>
                  <p className="text-xs text-[#26221C]/40">{msg.guest_phone}</p>
                </OpsTD>
                <OpsTD>
                  <p className="max-w-[320px] text-sm">{msg.message}</p>
                </OpsTD>
                <OpsTD>
                  {msg.reply ? (
                    <p className="max-w-[320px] text-sm text-[#C6A15B]">{msg.reply}</p>
                  ) : (
                    <span className="text-xs text-[#26221C]/35">—</span>
                  )}
                </OpsTD>
                <OpsTD><StatusPill value={msg.status} /></OpsTD>
                <OpsTD className="text-xs text-[#26221C]/50">{formatDate(msg.created_at)}</OpsTD>
                <OpsTD className="text-right">
                  <div className="flex justify-end gap-1">
                    {msg.status === "unread" && (
                      <Button size="sm" variant="outline" onClick={() => markRead(msg.id)}>
                        Mark Read
                      </Button>
                    )}
                    <Button size="sm" onClick={() => { setReplyingTo(msg); setReplyText(""); }}>
                      <Reply className="mr-1 h-3.5 w-3.5" /> Reply
                    </Button>
                    <button onClick={() => removeMessage(msg)} className="ml-1 rounded-md p-1.5 text-[#26221C]/30 hover:text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </OpsTD>
              </tr>
            ))}
          </tbody>
        </OpsTable>
      )}

      {/* Reply Modal */}
      {replyingTo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-semibold">Reply to {replyingTo.guest_name}</h3>
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
