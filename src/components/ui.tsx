import {
  useEffect,
  useId,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";
import { formatDate, statusLabel, statusTone } from "@/lib/arena3/labels";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { EASE_SMOOTH } from "./motion";

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline" | "danger" | "ink";
  size?: "md" | "sm" | "lg";
}) {
  const base =
    "sweep inline-flex items-center justify-center gap-2 font-medium tracking-tight transition-[opacity,transform,background-color,box-shadow,color] duration-200 ease-[var(--ease-smooth)] disabled:opacity-50 disabled:pointer-events-none active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg";
  // Fully-rounded: a pill reads as "pressable" at a glance and is the one shape
  // that never fights the square data tables and court grids around it.
  const sizes = {
    lg: "min-h-13 rounded-[var(--radius-pill)] px-7 text-[0.95rem]",
    md: "min-h-11 rounded-[var(--radius-pill)] px-5 text-sm",
    sm: "min-h-9 rounded-[var(--radius-pill)] px-4 text-xs",
  };
  const styles = {
    primary:
      "bg-accent text-accent-fg shadow-[var(--shadow-accent)] hover:bg-accent-2 hover:shadow-[var(--shadow-accent-lg)] hover:-translate-y-px",
    ink: "bg-fg text-bg hover:opacity-90 hover:-translate-y-px",
    outline:
      "border border-line bg-surface text-fg shadow-[var(--shadow-border)] hover:bg-wood hover:border-line-strong",
    ghost: "text-fg hover:bg-wood",
    danger: "bg-danger text-bg hover:opacity-90",
  } as const;
  return <button className={cn(base, sizes[size], styles[variant], className)} {...props} />;
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-[var(--radius-sm)] border border-line bg-surface px-3 text-sm text-fg placeholder:text-subtle outline-none transition-[box-shadow] duration-150 focus:ring-2 focus:ring-accent/30",
        className,
      )}
      {...props}
    />
  );
}

/** Native date picker with a readable "17 Sep 2026" overlay (Chromium ignores html lang). */
export function DateField({
  value,
  onChange,
  className,
  "aria-label": ariaLabel = "Pick a date",
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div
      className={cn(
        "relative h-11 min-w-[11rem] overflow-hidden rounded-[var(--radius-sm)] border border-line bg-surface",
        className,
      )}
    >
      <span className="pointer-events-none absolute inset-0 flex items-center px-3 text-sm tabular-nums text-fg">
        {value ? formatDate(value) : "Pick a date"}
      </span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </div>
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-11 w-full appearance-none rounded-[var(--radius-sm)] border border-line bg-surface bg-[length:12px] bg-[right_12px_center] bg-no-repeat px-3 pr-9 text-sm text-fg outline-none transition-[box-shadow] duration-150 focus:ring-2 focus:ring-accent/30",
        className,
      )}
      style={{
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='%235f6759' stroke-width='1.75' viewBox='0 0 24 24'><path d='m6 9 6 6 6-6'/></svg>")`,
      }}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-[var(--radius-sm)] border border-line bg-surface px-3 py-2 text-sm text-fg placeholder:text-subtle outline-none focus:ring-2 focus:ring-accent/30",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("kicker text-2xs text-muted", className)} {...props} />;
}

export function Card({
  className,
  interactive = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-xl)] bg-surface p-5 shadow-[var(--shadow-border)]",
        interactive &&
          "transition-[transform,box-shadow] duration-300 ease-[var(--ease-smooth)] hover:-translate-y-1 hover:shadow-[var(--shadow-soft)]",
        className,
      )}
      {...props}
    />
  );
}

export function Badge({
  tone = "ink",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: "ink" | "accent" | "hold" | "muted" | "danger" }) {
  const map = {
    ink: "bg-fg text-bg",
    accent: "bg-accent/12 text-accent-2",
    hold: "bg-hold/12 text-hold",
    muted: "bg-wood text-muted",
    danger: "bg-danger/10 text-danger",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-medium tabular-nums",
        map[tone],
        className,
      )}
      {...props}
    />
  );
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge tone={statusTone(status)} className={className}>
      {statusLabel(status)}
    </Badge>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </label>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-[var(--radius-md)] bg-wood", className)}>
      <div className="shimmer absolute inset-0" />
    </div>
  );
}

export function Empty({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <div className="grid place-items-center rounded-[var(--radius-xl)] border border-dashed border-line-strong/70 px-6 py-12 text-center">
      <p className="font-medium">{title}</p>
      {hint ? <p className="mt-1 max-w-sm text-sm text-muted">{hint}</p> : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

export function Seg({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const group = useId();
  const reduced = useReducedMotion();
  return (
    <div className="flex flex-wrap gap-1 rounded-[var(--radius-pill)] bg-wood p-1">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value || "all"}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={cn(
              "relative min-h-9 rounded-[var(--radius-pill)] px-4 text-sm font-medium transition-colors duration-200",
              active ? "text-accent-fg" : "text-muted hover:text-fg",
            )}
          >
            {/* Sliding pill travels between options instead of blinking on. */}
            {active ? (
              reduced ? (
                <span className="absolute inset-0 rounded-[var(--radius-pill)] bg-accent" />
              ) : (
                <motion.span
                  layoutId={`seg-${group}`}
                  className="absolute inset-0 rounded-[var(--radius-pill)] bg-accent shadow-[var(--shadow-accent)]"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )
            ) : null}
            <span className="relative z-[1]">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  // Escape closes the dialog, and the page behind it stops scrolling while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <motion.button
            type="button"
            className="absolute inset-0 bg-fg/40 backdrop-blur-[2px]"
            aria-label="Close"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.div
            className="relative mx-auto mt-[8vh] max-h-[84dvh] w-[min(32rem,calc(100%-2rem))] overflow-y-auto rounded-[var(--radius-xl)] bg-surface p-5 shadow-[var(--shadow-soft)]"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.28, ease: EASE_SMOOTH }}
          >
            <h2 id="modal-title" className="font-display text-2xl">
              {title}
            </h2>
            <div className="mt-4">{children}</div>
            {footer ? <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div> : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <Card>
      <p className="kicker text-2xs text-muted">{label}</p>
      <p className="athletic mt-2.5 text-4xl tabular-nums">{value}</p>
      {hint ? <p className="mt-1.5 text-sm text-muted">{hint}</p> : null}
    </Card>
  );
}
