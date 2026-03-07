import React, { useState, useRef, useEffect } from "react";
import { X, Send, Sparkles, Loader2, Bot, Trash2, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Reminder, ChatMessage } from "../types";
import { chatWithAssistant } from "../services/geminiService";

interface AIChatAssistantProps {
  reminders: Reminder[];
  onCompleteReminder: (id: string) => void;
  onDeleteReminder: (id: string) => void;
}

const QUICK_PROMPTS = [
  "What are my active reminders?",
  "Any triggered reminders?",
  "Summarize all my reminders",
  "How many reminders do I have?",
];

export const AIChatAssistant: React.FC<AIChatAssistantProps> = ({
  reminders,
  onCompleteReminder,
  onDeleteReminder,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi! 👋 I'm your GeoReminder AI assistant. Ask me anything about your reminders, or say things like \"delete the milk reminder\" or \"mark gym as done\"!",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 300);
  }, [isOpen]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = {
      role: "user",
      content: trimmed,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    // Fast-path local interceptor (0 tokens used!)
    const lowerText = trimmed.toLowerCase();

    // Regex 1: Detect requests to list/show reminders
    const listRegex = /^(?:show|list|what are|summarize|how many).*\b(?:reminders?|tasks?|today)\b/i;
    
    // Regex 2: Detect attempts to create a new reminder via chat (e.g. "remind me to...")
    const addRegex = /\b(?:remind me to|add a reminder|create a reminder)\b\s+(.+)/i;

    if (listRegex.test(lowerText)) {
      const pendingReminders = reminders.filter(r => r.status !== "completed");
      let replyContent = "";

      if (pendingReminders.length === 0) {
        replyContent = "You don't have any active reminders right now! You can set one by tapping the + button.";
      } else {
        replyContent = `You have ${pendingReminders.length} pending reminder(s):\n\n` +
          pendingReminders.map(r => `• ${r.emoji ?? "📌"} **${r.title}** ${r.status === 'triggered' ? '(🔔 Triggered)' : ''}`).join("\n");
      }

      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: replyContent, timestamp: Date.now() },
        ]);
        setIsLoading(false);
      }, 600); // Slight delay for a natural feel
      return;
    }

    const matchAdd = lowerText.match(addRegex);
    if (matchAdd) {
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `I see you want to be reminded to "${matchAdd[1]}". I cannot determine your location yet! Please tap the big **+ button** on the dashboard to set the location for this reminder.`, timestamp: Date.now() },
        ]);
        setIsLoading(false);
      }, 600);
      return;
    }

    try {
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const result = await chatWithAssistant(trimmed, history, reminders);

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: result.reply, timestamp: Date.now() },
      ]);

      // Handle action
      if (result.action && result.action.type !== "none") {
        const { type, reminderTitle } = result.action;
        const match = reminders.find(
          (r) =>
            r.title.toLowerCase().includes(reminderTitle?.toLowerCase() ?? "") ||
            (reminderTitle?.toLowerCase() ?? "").includes(r.title.toLowerCase()),
        );
        if (match) {
          if (type === "complete") {
            onCompleteReminder(match.id);
            setActionFeedback(`✅ Marked "${match.title}" as done`);
          }
          if (type === "delete") {
            onDeleteReminder(match.id);
            setActionFeedback(`🗑️ Deleted "${match.title}"`);
          }
          setTimeout(() => setActionFeedback(null), 3000);
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating sparkle button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-2xl shadow-violet-500/40 flex items-center justify-center"
            title="AI Assistant"
          >
            <Sparkles size={22} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Action feedback toast */}
      <AnimatePresence>
        {actionFeedback && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 right-6 z-[200] bg-slate-800 text-white text-sm px-4 py-2 rounded-xl shadow-xl font-medium"
          >
            {actionFeedback}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: "spring", damping: 22, stiffness: 280 }}
            className="fixed bottom-6 right-6 z-50 w-[360px] h-[540px] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-violet-600 to-indigo-600 flex items-center gap-3 shrink-0">
              <div className="bg-white/20 p-2 rounded-xl">
                <Bot size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-bold text-sm">GeoReminder AI</h3>
                <p className="text-violet-200 text-xs">
                  {reminders.length} reminder{reminders.length !== 1 ? "s" : ""} loaded
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-xl transition"
              >
                <X size={18} className="text-white" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center mr-2 mt-1 shrink-0">
                      <Sparkles size={12} className="text-violet-600" />
                    </div>
                  )}
                  <div
                    className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-br-sm"
                        : "bg-slate-100 text-slate-800 rounded-bl-sm"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                    <Sparkles size={12} className="text-violet-600" />
                  </div>
                  <div className="bg-slate-100 px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Quick prompts — shown only at start */}
            {messages.length <= 1 && (
              <div className="px-4 pb-2 flex flex-wrap gap-1.5 shrink-0">
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => sendMessage(p)}
                    className="text-xs px-3 py-1.5 bg-violet-50 text-violet-700 border border-violet-200 rounded-full hover:bg-violet-100 transition-colors font-medium"
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}

            {/* Reminder quick actions */}
            {messages.length <= 1 && reminders.filter((r) => r.status !== "completed").length > 0 && (
              <div className="px-4 pb-3 shrink-0">
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-1.5">Quick Actions</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {reminders
                    .filter((r) => r.status !== "completed")
                    .slice(0, 4)
                    .map((r) => (
                      <div
                        key={r.id}
                        className="shrink-0 flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5"
                      >
                        <span className="text-xs">{r.emoji ?? "📌"}</span>
                        <span className="text-xs text-slate-600 max-w-[80px] truncate font-medium">{r.title}</span>
                        <button
                          onClick={() => { onCompleteReminder(r.id); setActionFeedback(`✅ Marked "${r.title}" as done`); setTimeout(() => setActionFeedback(null), 3000); }}
                          className="text-green-500 hover:text-green-700 transition ml-1"
                          title="Mark done"
                        >
                          <CheckCircle2 size={13} />
                        </button>
                        <button
                          onClick={() => { onDeleteReminder(r.id); setActionFeedback(`🗑️ Deleted "${r.title}"`); setTimeout(() => setActionFeedback(null), 3000); }}
                          className="text-red-400 hover:text-red-600 transition"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="p-4 border-t border-slate-100 shrink-0">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
                  placeholder="Ask about your reminders..."
                  className="flex-1 px-4 py-2.5 bg-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-400 transition"
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={isLoading || !input.trim()}
                  className="w-10 h-10 flex items-center justify-center bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl text-white disabled:opacity-40 transition hover:opacity-90 shrink-0"
                >
                  <Send size={15} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
