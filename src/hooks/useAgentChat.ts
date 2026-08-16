import { useState, useCallback, useRef } from "react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface UseAgentChatOptions {
  maxRetries?: number;
  timeout?: number;
}

export function useAgentChat(endpoint: string, options: UseAgentChatOptions = {}) {
  const { maxRetries = 2, timeout = 30000 } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const retryCountRef = useRef(0);

  const send = useCallback(
    async (userMessage: string) => {
      if (!userMessage.trim() || isStreaming) return;

      setError(null);
      setIsStreaming(true);
      retryCountRef.current = 0;

      const userMsg: ChatMessage = { role: "user", content: userMessage };
      setMessages((prev) => [...prev, userMsg]);

      const assistantMsg: ChatMessage = { role: "assistant", content: "" };
      setMessages((prev) => [...prev, assistantMsg]);

      abortRef.current = new AbortController();
      const timeoutId = setTimeout(() => abortRef.current?.abort(), timeout);

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: userMessage,
            history: messages.slice(-10),
          }),
          signal: abortRef.current.signal,
        });

        if (!response.ok) {
          if (response.status === 429) {
            throw new Error("rate_limited");
          }
          throw new Error(`Server error: ${response.status}`);
        }

        const contentType = response.headers.get("content-type") || "";

        if (contentType.includes("text/event-stream")) {
          const reader = response.body?.getReader();
          const decoder = new TextDecoder();
          let fullContent = "";

          if (reader) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split("\n");

              for (const line of lines) {
                if (line.startsWith("data: ")) {
                  const data = line.slice(6);
                  if (data === "[DONE]") break;
                  try {
                    const parsed = JSON.parse(data);
                    fullContent += parsed.content || parsed.text || data;
                  } catch {
                    fullContent += data;
                  }
                  setMessages((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                      role: "assistant",
                      content: fullContent,
                    };
                    return updated;
                  });
                }
              }
            }
          }
        } else {
          const data = await response.json();
          const content = data.response || data.message || data.content || "";
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: "assistant", content };
            return updated;
          });
        }
      } catch (err) {
        const error = err as Error;

        if (error.name === "AbortError") {
          setError("Response timed out. Please try again.");
        } else if (error.message === "rate_limited") {
          if (retryCountRef.current < maxRetries) {
            retryCountRef.current++;
            const delay = retryCountRef.current * 2000;
            setError(`Agent is busy. Retrying in ${delay / 1000}s...`);
            setTimeout(() => send(userMessage), delay);
            return;
          }
          setError("I'm experiencing high demand right now. Please try again in a minute.");
        } else {
          setError("Connection issue. Please try again.");
        }

        setMessages((prev) => {
          if (
            prev[prev.length - 1]?.role === "assistant" &&
            prev[prev.length - 1]?.content === ""
          ) {
            return prev.slice(0, -1);
          }
          return prev;
        });
      } finally {
        clearTimeout(timeoutId);
        setIsStreaming(false);
      }
    },
    [endpoint, messages, isStreaming, timeout, maxRetries],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const clear = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, send, stop, clear, isStreaming, error };
}
