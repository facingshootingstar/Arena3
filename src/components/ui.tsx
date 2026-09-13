import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";
import { formatViDate, statusLabel, statusTone } from "@/lib/arena3/labels";

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline" | "danger" | "ink";
  size?: "md" | "sm";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 font-medium tracking-tight transition-[opacity,transform,background-color,box-shadow] duration-150 ease-[var(--ease-smooth)] disabled:opacity-50 disabled:pointer-events-none active:scale-[0.96]";
  const sizes = {
    md: "min-h-11 rounded-[var(--radius-sm)] px-4 text-sm",
    sm: "min-h-9 rounded-[var(--radius-sm)] px-3 text-xs",
  };
  const styles = {
    primary: "bg-accent text-accent-fg hover:bg-accent-2",
    ink: "bg-fg text-bg hover:opacity-90",
    outline: "border border-line bg-surface text-fg shadow-[var(--shadow-border)] hover:bg-wood",
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

/** Native date picker with a Vietnamese dd/MM/yyyy overlay (Chromium ignores html lang). */
export function DateField({
  value,
  onChange,
  className,
  "aria-label": ariaLabel = "Chọn ngày",
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
        {value ? formatViDate(value) : "dd/mm/yyyy"}
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
  return <span className={cn("text-2xs font-medium uppercase tracking-wider text-muted", className)} {...props} />;
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-[var(--radius-xl)] bg-surface p-5 shadow-[var(--shadow-border)]", className)} {...props} />
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
  return <div className={cn("animate-pulse rounded-[var(--radius-md)] bg-wood", className)} />;
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
  return (
    <div className="flex flex-wrap gap-1 rounded-[var(--radius-md)] bg-wood p-1">
      {options.map((o) => (
        <button
          key={o.value || "all"}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "min-h-9 rounded-[var(--radius-sm)] px-3 text-sm font-medium transition-colors duration-150",
            value === o.value ? "bg-fg text-bg" : "text-muted hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
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
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <button type="button" className="absolute inset-0 bg-fg/35" aria-label="Đóng" onClick={onClose} />
      <div className="relative mx-auto mt-[8vh] max-h-[84dvh] w-[min(32rem,calc(100%-2rem))] overflow-y-auto rounded-[var(--radius-xl)] bg-surface p-5 shadow-[var(--shadow-soft)]">
        <h2 id="modal-title" className="font-display text-2xl">
          {title}
        </h2>
        <div className="mt-4">{children}</div>
        {footer ? <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
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
      <p className="text-2xs font-medium uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-2 font-display text-4xl tabular-nums tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-sm text-muted">{hint}</p> : null}
    </Card>
  );
}
