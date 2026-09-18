import { createFileRoute, Link } from "@tanstack/react-router";
import { Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui";
import { AnimatePresence, motion } from "motion/react";
import { apiPost } from "@/lib/arena3/client";
import { cn } from "@/lib/cn";

export const Route = createFileRoute("/app/assistant")({ component: Page });

type Msg = { role: "me" | "bot"; text: string; source?: "gemini" | "xai" | "rules" };

const CHIPS = [
  "What are your opening hours?",
  "Which plans are on sale?",
  "Who coaches badminton?",
  "How do I cancel a court?",
];

const WELCOME: Msg = {
  role: "bot",
  text: "Ask about the timetable, plans, coaches, cancelling, or waitlists. Every answer is grounded in the centre's own data. Type «ticket: …» to send a note to the desk.",
};

function sourceLabel(s?: Msg["source"]) {
  if (s === "gemini") return "Gemini";
  if (s === "xai") return "Grok";
  if (s === "rules") return "in-house";
  return null;
}

function Page() {
  const [q, setQ] = useState("");
  const [log, setLog] = useState<Msg[]>([WELCOME]);
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [log, busy]);

  async function send(text?: string) {
    const message = (text ?? q).trim();
    if (message.length < 2 || busy) return;
    setQ("");
    const nextLog: Msg[] = [...log, { role: "me", text: message }];
    setLog(nextLog);
    setBusy(true);
    try {
      const history = nextLog
        .filter((m) => m !== WELCOME)
        .slice(0, -1)
        .map((m) => ({ role: m.role, text: m.text }));
      const r = await apiPost<{ reply: string; source?: Msg["source"] }>("/assistant", { message, history });
      setLog((l) => [...l, { role: "bot", text: r.reply, source: r.source }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The assistant is switched off");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell role="member" title="Assistant" subtitle="Gemini answers, grounded in Arena3's own timetable, plans and coaches.">
      <div className="mx-auto grid max-w-2xl gap-3">
        {log.map((m, i) => (
          <motion.div
            key={`${i}-${m.role}`}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "max-w-[85%] rounded-[var(--radius-lg)] px-4 py-3 shadow-[var(--shadow-border)]",
              m.role === "me"
                ? "ml-auto bg-accent text-accent-fg"
                : "mr-auto bg-surface text-fg",
            )}
          >
            <p className={cn("text-2xs uppercase tracking-wider", m.role === "me" ? "text-accent-fg/70" : "text-muted")}>
              {m.role === "me" ? "You" : "Assistant"}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{m.text}</p>
            {m.role === "bot" && sourceLabel(m.source) ? (
              <p className="mt-2 text-2xs uppercase tracking-wider text-muted">{sourceLabel(m.source)}</p>
            ) : null}
          </motion.div>
        ))}
        <AnimatePresence>
        {busy ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mr-auto max-w-[85%] rounded-[var(--radius-lg)] bg-surface px-4 py-3 shadow-[var(--shadow-border)]"
          >
            <p className="text-2xs uppercase tracking-wider text-muted">Assistant</p>
            <p className="mt-1 flex items-center gap-1 text-sm text-muted">
              Typing
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="inline-block size-1 rounded-full bg-muted"
                  animate={{ opacity: [0.2, 1, 0.2] }}
                  transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
                />
              ))}
            </p>
          </motion.div>
        ) : null}
        </AnimatePresence>
        <div ref={bottom} />
      </div>

      {!busy && log.length < 3 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mt-4 flex max-w-2xl flex-wrap gap-2"
        >
          {CHIPS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => void send(c)}
              className="rounded-full border border-line bg-surface px-3 py-2 text-xs font-medium text-fg transition-[background-color,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-accent hover:bg-wood active:scale-95"
            >
              {c}
            </button>
          ))}
        </motion.div>
      ) : null}

      <form
        className="mx-auto mt-4 flex max-w-2xl gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask about prices, opening hours, coaches…"
          disabled={busy}
          className="h-11 min-w-0 flex-1 rounded-[var(--radius-sm)] border border-line bg-surface px-3 text-sm text-fg placeholder:text-subtle outline-none transition-[box-shadow] duration-150 focus:ring-2 focus:ring-accent/30"
        />
        <Button type="submit" disabled={busy || q.trim().length < 2} aria-label="Send" className="size-11 shrink-0 px-0">
          <Send className="size-4" />
        </Button>
      </form>
      <p className="mx-auto mt-2 max-w-2xl text-2xs text-muted">
        No medical advice. Booking still happens on{" "}
        <Link to="/app/book" className="underline">
          Book
        </Link>{" "}
        and{" "}
        <Link to="/app/classes" className="underline">
          Classes
        </Link>
        .
      </p>
    </Shell>
  );
}
