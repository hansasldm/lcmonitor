import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, Send, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage, ChatMessageData } from "./ChatMessage";
import { ChatQuickActions, QuickAction } from "./ChatQuickActions";

// ─── MOCK RESPONSES ───────────────────────────────────────────────
// TODO: Replace with real AI API call (e.g. Supabase Edge Function or OpenAI)
function getMockResponse(input: string): string {
  const q = input.toLowerCase();

  if (q.includes("who is working") || q.includes("working now")) {
    // TODO: Replace with live query to work_sessions table (clock_out IS NULL)
    return "Currently clocked-in employees:\n• Juan Dela Cruz — clocked in at 8:02 AM\n• Maria Santos — clocked in at 8:15 AM\n• Alex Reyes — clocked in at 9:01 AM\n\n3 of 12 employees are currently clocked in.";
  }
  if (q.includes("attendance") || q.includes("today's attendance")) {
    // TODO: Replace with live query to attendance table for today
    return "Today's Attendance Summary:\n• Present: 10\n• Absent: 1\n• On Leave: 1\n• Total: 12\n\nAll present employees clocked in before 9:00 AM.";
  }
  if (q.includes("timesheet") || q.includes("explain")) {
    // TODO: Replace with live query to work_sessions for current user
    return "Your Timesheet This Week:\n• Mon: 8h 12m\n• Tue: 7h 45m\n• Wed: 8h 30m\n• Thu: 8h 05m (today so far)\n\nTotal: 32h 32m — you're on track for a full 40-hour week.";
  }

  return "I can help you with attendance tracking, timesheets, screenshots, and general app usage. Try one of the quick actions above, or ask me anything about LC Tracker!";
}
// ──────────────────────────────────────────────────────────────────

interface ChatPanelProps {
  onClose: () => void;
}

export function ChatPanel({ onClose }: ChatPanelProps) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessageData[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hi! I'm your LC Assistant. How can I help you today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom on new messages
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // ─── SEND MESSAGE ─────────────────────────────────────────────
  // TODO: Replace getMockResponse() with a fetch() call to your AI endpoint
  // e.g. const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, { ... })
  const sendMessage = async (text: string, navigateTo?: string) => {
    if (!text.trim()) return;

    const userMsg: ChatMessageData = {
      id: crypto.randomUUID(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    // Navigate if the quick action has a route
    if (navigateTo) {
      navigate(navigateTo);
    }

    // Simulate async delay
    await new Promise((r) => setTimeout(r, 800));

    const assistantMsg: ChatMessageData = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: getMockResponse(text),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, assistantMsg]);
    setIsLoading(false);
  };

  const handleQuickAction = (action: QuickAction) => {
    sendMessage(action.message, action.navigateTo);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="fixed bottom-20 right-4 z-50 w-[380px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200"
      style={{ height: "min(520px, calc(100vh - 8rem))" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary text-primary-foreground">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-primary-foreground/20 flex items-center justify-center">
            <Bot className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold leading-tight">LC Assistant</h3>
            <p className="text-[11px] opacity-80 leading-tight">
              Ask about attendance, timesheets, screenshots & more
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Quick Actions */}
      <ChatQuickActions onAction={handleQuickAction} />

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-3" ref={scrollRef}>
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {isLoading && (
          <div className="flex justify-start mb-3">
            <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-2.5 text-sm text-muted-foreground">
              <span className="inline-flex gap-1">
                <span className="animate-bounce" style={{ animationDelay: "0ms" }}>•</span>
                <span className="animate-bounce" style={{ animationDelay: "150ms" }}>•</span>
                <span className="animate-bounce" style={{ animationDelay: "300ms" }}>•</span>
              </span>
            </div>
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3 border-t border-border bg-card">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question..."
          disabled={isLoading}
          className="flex-1 h-9 text-sm rounded-full bg-muted/50"
        />
        <Button type="submit" size="icon" disabled={isLoading || !input.trim()} className="h-9 w-9 rounded-full shrink-0">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
