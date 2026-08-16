import { useState, useRef, useEffect, useCallback } from "react";
import { Send, X, MessageCircle, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAgentChat } from "@/hooks/useAgentChat";

const QUICK_PROMPTS = [
  {
    emoji: "🏨",
    label: "Rooms & Rates",
    prompt: "What rooms are available and what are the rates?",
  },
  {
    emoji: "🚤",
    label: "Island Hopping",
    prompt: "What island hopping tours do you offer and what are the prices?",
  },
  {
    emoji: "🚐",
    label: "Airport Transfer",
    prompt: "Can you arrange airport pickup or transfer? What are the options?",
  },
  {
    emoji: "📶",
    label: "WiFi",
    prompt: "What is the WiFi password and is it fast enough for remote work?",
  },
  {
    emoji: "🍳",
    label: "Meals",
    prompt: "What meal options do you have? Can you accommodate dietary needs?",
  },
  {
    emoji: "💳",
    label: "Payment",
    prompt: "What payment methods do you accept? Do you take GCash or cards?",
  },
  {
    emoji: "📅",
    label: "Availability",
    prompt: "I'd like to check availability. What dates do you have open?",
  },
  { emoji: "🏄", label: "Activities", prompt: "What activities can I do near the resort?" },
];

interface ResortChatProps {
  endpoint?: string;
  className?: string;
}

export default function ResortChat({ endpoint = "/api/chat", className }: ResortChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [showQuickPrompts, setShowQuickPrompts] = useState(true);
  const { messages, send, isStreaming, error } = useAgentChat(endpoint);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = async (text?: string) => {
    const message = text || input.trim();
    if (!message || isStreaming) return;

    setInput("");
    setShowQuickPrompts(false);
    await send(message);
  };

  const handleQuickPrompt = (prompt: string) => {
    handleSubmit(prompt);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={cn(
            "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center",
            "rounded-full bg-[#C6A15B] text-[#221D14] shadow-lg shadow-[#C6A15B]/30",
            "transition-all duration-200 hover:scale-105 hover:shadow-xl active:scale-95",
            className,
          )}
          aria-label="Chat with us"
        >
          <MessageCircle className="h-6 w-6" strokeWidth={1.75} />
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#C6A15B] opacity-75" />
            <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-[#C6A15B]" />
          </span>
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 z-50 flex h-[520px] w-[360px] flex-col overflow-hidden rounded-2xl border border-[#26221C]/10 bg-[#FAF6EF] shadow-2xl sm:h-[560px] sm:w-[400px]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#26221C]/8 bg-[#26221C] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#C6A15B]/20">
                <Sparkles className="h-4 w-4 text-[#C6A15B]" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Marina Terrace</p>
                <p className="text-[11px] text-white/50">
                  {isStreaming ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> Thinking...
                    </span>
                  ) : (
                    "Online · Usually replies instantly"
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {/* Welcome message */}
            {messages.length === 0 && (
              <div className="mb-4">
                <div className="mb-3 rounded-xl rounded-bl-sm bg-white p-3.5 shadow-sm">
                  <p className="text-sm text-[#26221C]/80">
                    Hi there! 👋 Welcome to Marina Terrace, Palawan. I'm your AI concierge. Ask me
                    anything about rooms, tours, transfers, or tap a topic below.
                  </p>
                </div>
              </div>
            )}

            {/* Quick Prompts */}
            {showQuickPrompts && messages.length === 0 && (
              <div className="mb-4 grid grid-cols-2 gap-2">
                {QUICK_PROMPTS.map((qp) => (
                  <button
                    key={qp.label}
                    onClick={() => handleQuickPrompt(qp.prompt)}
                    disabled={isStreaming}
                    className="flex items-center gap-2 rounded-lg border border-[#26221C]/8 bg-white px-3 py-2.5 text-left text-xs font-medium text-[#26221C]/70 shadow-sm transition-all hover:border-[#C6A15B]/40 hover:bg-[#C6A15B]/5 hover:text-[#26221C] active:scale-[0.97] disabled:opacity-50"
                  >
                    <span className="text-sm">{qp.emoji}</span>
                    {qp.label}
                  </button>
                ))}
              </div>
            )}

            {/* Message Bubbles */}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn("mb-3 flex", msg.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
                    msg.role === "user"
                      ? "rounded-br-sm bg-[#26221C] text-white"
                      : "rounded-bl-sm bg-white text-[#26221C]/85 shadow-sm",
                  )}
                >
                  {msg.content}
                  {isStreaming && i === messages.length - 1 && msg.role === "assistant" && (
                    <span className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-[#C6A15B]" />
                  )}
                </div>
              </div>
            ))}

            {/* Streaming skeleton */}
            {isStreaming && messages[messages.length - 1]?.role === "user" && (
              <div className="mb-3 flex justify-start">
                <div className="rounded-xl rounded-bl-sm bg-white px-3.5 py-2.5 shadow-sm">
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#C6A15B] [animation-delay:0ms]" />
                    <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#C6A15B] [animation-delay:150ms]" />
                    <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#C6A15B] [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-[#26221C]/8 bg-white px-3 py-3">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about rooms, tours, transfers..."
                disabled={isStreaming}
                className="flex-1 rounded-full border border-[#26221C]/10 bg-[#FAF6EF] px-4 py-2.5 text-sm text-[#26221C] placeholder:text-[#26221C]/35 focus:border-[#C6A15B]/50 focus:outline-none focus:ring-1 focus:ring-[#C6A15B]/30 disabled:opacity-50"
              />
              <button
                onClick={() => handleSubmit()}
                disabled={!input.trim() || isStreaming}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#C6A15B] text-[#221D14] transition-all hover:bg-[#B8944F] active:scale-95 disabled:opacity-40"
                aria-label="Send message"
              >
                {isStreaming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] text-[#26221C]/30">
              AI concierge · For urgent matters, contact front desk
            </p>
          </div>
        </div>
      )}
    </>
  );
}
