import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChefHat, X, Send, Loader2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

const CHEF_TOOLTIP_KEY = "sonoma-chef-tooltip-seen";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const BASE_URL = import.meta.env.BASE_URL ?? "/";
const API_BASE = `${BASE_URL}api`.replace(/\/+/g, "/").replace(/\/$/, "");

async function createConversation(): Promise<number> {
  const res = await fetch(`${API_BASE}/openai/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Sonoma Chef Chat" }),
  });
  if (!res.ok) throw new Error("Failed to create conversation");
  const data = await res.json();
  return data.id;
}

async function* streamMessage(
  conversationId: number,
  content: string
): AsyncGenerator<string> {
  const res = await fetch(
    `${API_BASE}/openai/conversations/${conversationId}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    }
  );

  if (!res.ok || !res.body) throw new Error("Failed to send message");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const data = JSON.parse(line.slice(6));
        if (data.done) return;
        if (data.content) yield data.content;
      } catch {}
    }
  }
}

const PROMPTS = [
  "What's in season right now in Sonoma?",
  "Pair a wine with dry-farmed heirloom tomatoes",
  "Best under-the-radar spots in Healdsburg?",
  "What makes Dry Creek Kitchen worth it?",
];

export function SonomaChef() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [showTooltip, setShowTooltip] = useState(
    () => !localStorage.getItem(CHEF_TOOLTIP_KEY)
  );
  const dismissTooltip = useCallback(() => {
    localStorage.setItem(CHEF_TOOLTIP_KEY, "1");
    setShowTooltip(false);
  }, []);
  useEffect(() => {
    if (!showTooltip) return;
    const t = setTimeout(dismissTooltip, 7000);
    return () => clearTimeout(t);
  }, [showTooltip, dismissTooltip]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const ensureConversation = useCallback(async (): Promise<number> => {
    if (conversationId) return conversationId;
    const id = await createConversation();
    setConversationId(id);
    return id;
  }, [conversationId]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
      setInput("");
      setLoading(true);

      const assistantMsg: Message = { role: "assistant", content: "" };
      setMessages((prev) => [...prev, assistantMsg]);

      try {
        const id = await ensureConversation();
        const stream = streamMessage(id, trimmed);
        for await (const chunk of stream) {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: updated[updated.length - 1].content + chunk,
            };
            return updated;
          });
        }
      } catch {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content:
              "Something went wrong. Give it a moment and try again.",
          };
          return updated;
        });
      } finally {
        setLoading(false);
      }
    },
    [loading, ensureConversation]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const resetChat = () => {
    setMessages([]);
    setConversationId(null);
    setInput("");
  };

  return (
    <>
      {/* First-time tooltip */}
      {!open && showTooltip && (
        <div className="fixed bottom-[72px] right-6 z-[1001] w-[220px] bg-card border border-border rounded-xl shadow-xl p-3.5 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <button
            onClick={dismissTooltip}
            className="absolute top-2.5 right-2.5 h-5 w-5 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <ChefHat className="w-3.5 h-3.5 text-primary" />
            </div>
            <p className="text-xs font-semibold text-foreground">Meet Sonoma Chef</p>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            An AI that knows every winery, farm, and table on this map. Ask it anything.
          </p>
          {/* Arrow pointing down */}
          <div className="absolute -bottom-[7px] right-6 w-3 h-3 bg-card border-r border-b border-border rotate-45" />
        </div>
      )}

      {/* Floating trigger button */}
      {!open && (
        <button
          onClick={() => { setOpen(true); dismissTooltip(); }}
          className="fixed bottom-6 right-6 z-[1000] flex items-center gap-2.5 bg-primary text-primary-foreground px-4 py-3 rounded-2xl shadow-lg hover:shadow-xl hover:brightness-105 transition-all duration-200 font-medium text-sm"
        >
          <ChefHat className="w-4 h-4" />
          Ask Sonoma Chef
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-0 right-0 z-[1000] w-full sm:w-[400px] sm:bottom-6 sm:right-6 flex flex-col bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden"
          style={{ maxHeight: "min(600px, calc(100dvh - 80px))" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <ChefHat className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-serif font-semibold text-foreground text-sm leading-tight">Sonoma Chef</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Culinary Authority</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={resetChat}
                  title="New conversation"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => setOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0"
          >
            {messages.length === 0 && (
              <div className="space-y-4">
                <div className="text-center pt-4 pb-2">
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px] mx-auto">
                    The land. The labor. The flavor. Ask anything about Sonoma's food and wine ecosystem.
                  </p>
                </div>
                <div className="space-y-2">
                  {PROMPTS.map((p) => (
                    <button
                      key={p}
                      onClick={() => sendMessage(p)}
                      className="w-full text-left text-sm px-3.5 py-2.5 rounded-xl border border-border bg-muted/40 text-foreground hover:bg-muted transition-colors leading-snug"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  )}
                >
                  {msg.content || (
                    <span className="inline-flex gap-1 items-center h-4">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border bg-card flex-shrink-0">
            <div className="flex gap-2 items-end">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about wineries, farms, pairings..."
                className="resize-none min-h-[42px] max-h-[120px] text-sm bg-background rounded-xl leading-relaxed"
                rows={1}
                disabled={loading}
              />
              <Button
                size="icon"
                className="h-[42px] w-[42px] rounded-xl flex-shrink-0"
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-center text-[10px] text-muted-foreground mt-2">
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      )}
    </>
  );
}
