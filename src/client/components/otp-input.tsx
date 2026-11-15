import { useEffect, useId, useRef, useState } from "react";
import { Input } from "./ui";
import { t } from "../lib/i18n";

export function OtpInput({ value, onChange, invalid, errorId }: {
  value: string; onChange: (value: string) => void; invalid?: boolean; errorId?: string;
}) {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const label = useId();
  const digits = value.padEnd(6, " ").split("");
  const focus = (index: number) => inputs.current[Math.max(0, Math.min(5, index))]?.focus();
  const fill = (index: number, text: string) => {
    if (!/^[0-9]*$/.test(text)) return;
    if (text.length === 6) { onChange(text); focus(5); return; }
    digits[index] = text.slice(-1) || " ";
    onChange(digits.join("").trimEnd());
    if (text) focus(index + 1);
  };
  return <div role="group" aria-labelledby={label} aria-describedby={invalid ? errorId : undefined}>
    <p id={label} className="mb-2 text-center text-sm font-medium">{t("6-digit code")}</p>
    <div className="mx-auto grid w-full max-w-72 grid-cols-6 gap-2">
      {digits.map((digit, index) => <Input key={index}
        ref={(node) => { inputs.current[index] = node; }}
        className={`aspect-square h-auto min-w-0 px-0 text-center text-xl tabular-nums ${invalid ? "border-danger" : ""}`}
        aria-label={t("Digit {n}", { n: index + 1 })} aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        inputMode="numeric" autoComplete={index === 0 ? "one-time-code" : "off"}
        value={digit.trim()} required pattern="[0-9]" maxLength={6}
        onFocus={(e) => e.target.select()}
        onChange={(e) => fill(index, e.target.value)}
        onPaste={(e) => {
          e.preventDefault();
          const code = e.clipboardData.getData("text").trim();
          if (/^[0-9]{6}$/.test(code)) fill(0, code);
        }}
        onKeyDown={(e) => {
          if (e.key === "Backspace" && !digit.trim()) { e.preventDefault(); focus(index - 1); }
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault(); focus(index + (e.key === "ArrowLeft" ? -1 : 1));
          }
        }} />)}
    </div>
  </div>;
}

export function OtpResend({ until, disabled, onResend }: { until: number; disabled: boolean; onResend: () => void }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.ceil((until - now) / 1000));
  return <div className="border-t border-line pt-4 text-center text-sm">
    <button type="button" className="hit text-accent-2 underline underline-offset-2 disabled:text-muted disabled:no-underline"
      disabled={disabled || seconds > 0} onClick={onResend}>
      {seconds ? t("Resend in {seconds}s", { seconds }) : t("Didn't get a code? Resend")}
    </button>
  </div>;
}
