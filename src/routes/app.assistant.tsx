import { createFileRoute, Link } from "@tanstack/react-router";
import { Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui";
import { apiPost } from "@/lib/arena3/client";
import { cn } from "@/lib/cn";

export const Route = createFileRoute("/app/assistant")({ component: Page });

type Msg = { role: "me" | "bot"; text: string; source?: "gemini" | "xai" | "rules" };

const CHIPS = ["Giờ mở cửa?", "Gói nào đang bán?", "HLV cầu lông là ai?", "Hủy sân thế nào?"];

const WELCOME: Msg = {
  role: "bot",
  text: "Hỏi lịch, gói, HLV, hủy đặt, waitlist. Câu trả lời neo theo dữ liệu trung tâm. Gõ «ticket: …» để gửi quầy.",
};

function sourceLabel(s?: Msg["source"]) {
  if (s === "gemini") return "Gemini";
  if (s === "xai") return "Grok";
  if (s === "rules") return "nội bộ";
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
      toast.error(e instanceof Error ? e.message : "Trợ lý đang tắt");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell role="member" title="Trợ lý" subtitle="Hỏi đáp bằng Gemini — neo lịch, gói, HLV Arena3.">
      <div className="mx-auto grid max-w-2xl gap-3">
        {log.map((m, i) => (
          <div
            key={`${i}-${m.role}`}
            className={cn(
              "max-w-[85%] rounded-[var(--radius-lg)] px-4 py-3 shadow-[var(--shadow-border)]",
              m.role === "me"
                ? "ml-auto bg-accent text-accent-fg"
                : "mr-auto bg-surface text-fg",
            )}
          >
            <p className={cn("text-2xs uppercase tracking-wider", m.role === "me" ? "text-accent-fg/70" : "text-muted")}>
              {m.role === "me" ? "Bạn" : "Trợ lý"}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{m.text}</p>
            {m.role === "bot" && sourceLabel(m.source) ? (
              <p className="mt-2 text-2xs uppercase tracking-wider text-muted">{sourceLabel(m.source)}</p>
            ) : null}
          </div>
        ))}
        {busy ? (
          <div className="mr-auto max-w-[85%] rounded-[var(--radius-lg)] bg-surface px-4 py-3 shadow-[var(--shadow-border)]">
            <p className="text-2xs uppercase tracking-wider text-muted">Trợ lý</p>
            <p className="mt-1 text-sm text-muted">Đang soạn…</p>
          </div>
        ) : null}
        <div ref={bottom} />
      </div>

      {!busy && log.length < 3 ? (
        <div className="mx-auto mt-4 flex max-w-2xl flex-wrap gap-2">
          {CHIPS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => void send(c)}
              className="rounded-full border border-line bg-surface px-3 py-2 text-xs font-medium text-fg transition-colors duration-150 hover:bg-wood"
            >
              {c}
            </button>
          ))}
        </div>
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
          placeholder="Hỏi giá gói, giờ mở cửa, HLV…"
          disabled={busy}
          className="h-11 min-w-0 flex-1 rounded-[var(--radius-sm)] border border-line bg-surface px-3 text-sm text-fg placeholder:text-subtle outline-none transition-[box-shadow] duration-150 focus:ring-2 focus:ring-accent/30"
        />
        <Button type="submit" disabled={busy || q.trim().length < 2} aria-label="Gửi" className="size-11 shrink-0 px-0">
          <Send className="size-4" />
        </Button>
      </form>
      <p className="mx-auto mt-2 max-w-2xl text-2xs text-muted">
        Không tư vấn y khoa. Việc đặt chỗ vẫn làm trên{" "}
        <Link to="/app/book" className="underline">
          Đặt sân
        </Link>{" "}
        /{" "}
        <Link to="/app/classes" className="underline">
          Lớp
        </Link>
        .
      </p>
    </Shell>
  );
}
