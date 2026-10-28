import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ChangeEvent,
  type ComponentProps,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type RefObject,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { createLink } from "@tanstack/react-router";
import { createPortal } from "react-dom";
import {
  ArrowDownRight,
  ArrowUpRight,
  Check as CheckIcon,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Info,
  Loader2,
  Minus,
  X as XIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { PAGE_SIZES, lastPageOffset, pageWindow } from "@/lib/paging";
import { locale, t } from "@/lib/i18n";
import { formatDate, statusLabel, statusTone } from "@/lib/arena3/labels";
import { AnimatePresence, motion, useDragControls, useMotionValue, useReducedMotion } from "motion/react";
import { SPRING, project } from "../motion";
import { isEmptyFigure } from "@/lib/figure";

/**
 * filled (`primary`) is the one action of a screen; `tinted` a secondary action in the same hue;
 * `gray` a neutral one; `plain` a text action; `destructive` (alias `danger`) removes something.
 * `outline`, `ghost`, `ink` and `espresso` are the older names and keep their look.
 */
type ButtonVariant =
  | "primary"
  | "tinted"
  | "gray"
  | "plain"
  | "destructive"
  | "ghost"
  | "outline"
  | "danger"
  | "ink"
  | "espresso";
type ButtonSize = "md" | "sm" | "lg";
type ButtonLook = { variant?: ButtonVariant; size?: ButtonSize };

// The press answers on pointer-down (`active:`), on a spring-shaped curve, in 160ms: it is
// feedback, so it is never slower than the finger. A disabled button keeps its hue and loses its
// presence, instead of every kind collapsing into the same flat grey.
const BUTTON_BASE =
  "inline-flex items-center whitespace-nowrap justify-center gap-2 font-medium tracking-[-0.006em] transition-[opacity,transform,background-color,box-shadow,color] duration-[160ms] ease-[var(--ease-spring)] disabled:opacity-45 disabled:saturate-50 disabled:pointer-events-none disabled:shadow-none aria-busy:pointer-events-none active:scale-[0.97] active:duration-[60ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg";
const BUTTON_SIZES = {
  lg: "min-h-13 rounded-[var(--radius-md)] px-7 text-callout",
  md: "min-h-11 rounded-[var(--radius-md)] px-5 text-subheadline",
  // 44px on a phone (finger), 36px with a mouse: dense tables stay compact on a desk.
  sm: "min-h-11 rounded-[var(--radius-sm)] px-3.5 text-footnote sm:min-h-9",
} as const;
const BUTTON_STYLES = {
  primary: "bg-accent text-accent-fg shadow-[var(--shadow-sm)] hover:bg-accent-hover",
  tinted: "bg-accent-tint text-accent-text hover:bg-[color-mix(in_oklab,var(--color-accent)_18%,var(--color-surface))]",
  gray: "bg-fill-strong text-fg hover:bg-[color-mix(in_oklab,var(--color-fg)_14%,transparent)]",
  plain: "text-accent-text hover:bg-accent-tint",
  ink: "bg-espresso text-espresso-fg hover:opacity-90",
  espresso: "bg-espresso text-espresso-fg hover:opacity-90",
  outline: "border border-line-strong/70 bg-surface text-fg hover:bg-wood",
  ghost: "text-fg hover:bg-wood",
  danger: "bg-danger text-accent-fg hover:opacity-90",
  destructive: "bg-danger-tint text-danger hover:bg-[color-mix(in_oklab,var(--color-danger)_16%,var(--color-surface))]",
} as const;

/** The look of a button, for the things that must be a link but should read as a button. */
export function buttonClass({ variant = "primary", size = "md" }: ButtonLook = {}) {
  return cn(BUTTON_BASE, BUTTON_SIZES[size], BUTTON_STYLES[variant]);
}

export function Button({
  variant,
  size,
  className,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & ButtonLook & { loading?: boolean }) {
  return (
    <button
      className={cn(buttonClass({ variant, size }), loading && "disabled:opacity-100 disabled:saturate-100", className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 aria-hidden="true" className="size-4 animate-spin" strokeWidth={2.25} /> : null}
      {children}
    </button>
  );
}

/**
 * Plain `<a>` that looks like a button (for same-page `#anchors`). A `<button>` inside an `<a>` is
 * two tab stops and two announcements for one action, so a link that should look like a button is
 * styled itself instead.
 */
export function ButtonAnchor({ variant, size, className, ...props }: ComponentProps<"a"> & ButtonLook) {
  return <a className={cn(buttonClass({ variant, size }), className)} {...props} />;
}

/** A router link that looks like a button: one control, one tab stop, keeps prefetch and "open in new tab". */
export const ButtonLink = createLink(ButtonAnchor);

/**
 * Fields are filled, not boxed: a soft fill with a hairline edge, a deeper fill under the pointer
 * and, on focus, the surface colour with the accent edge and a wide soft ring. The ring is
 * the same on every field type (input, select, textarea, the date field's wrapper).
 */
const FIELD =
  "rounded-[var(--radius-sm)] border border-line bg-fill text-subheadline text-fg outline-none transition-[background-color,border-color,box-shadow] duration-150 ease-[var(--ease-spring)] hover:bg-fill-strong focus:border-accent/70 focus:bg-surface focus:ring-4 focus:ring-accent/15";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn("h-11 w-full px-3 placeholder:text-subtle", FIELD, className)} {...props} />;
}

/**
 * An amount of money typed the way people read it: 1,500,000 with the thousands set apart and
 * the currency sign beside it, instead of a bare run of digits that is easy to miscount by a zero.
 *
 * What the caller holds is digits only ("1500000"), so a plain `Number(value)` on save keeps
 * working; only what is drawn is formatted. The caret stays on the same digit while typing.
 */
export function MoneyInput({
  value,
  onChange,
  className,
  wrapClassName,
  ...props
}: Omit<ComponentProps<"input">, "value" | "onChange" | "type" | "ref"> & {
  value: string;
  onChange: (digits: string) => void;
  /** Sizing of the box that holds the field and its "đ" (width, margin); `className` styles the field itself. */
  wrapClassName?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  const [, redraw] = useState(0);
  const digits = value.replace(/\D/g, "");
  const shown = digits ? new Intl.NumberFormat(locale()).format(Number(digits)) : "";

  // After every typed key the text is re-formatted, which throws the caret to the end;
  // walk the new text until the same number of digits has gone by and put it back there.
  useLayoutEffect(() => {
    const el = ref.current;
    const want = caret.current;
    if (!el || want == null || document.activeElement !== el) return;
    caret.current = null;
    let pos = 0;
    let seen = 0;
    while (pos < shown.length && seen < want) {
      if (/\d/.test(shown[pos]!)) seen++;
      pos++;
    }
    el.setSelectionRange(pos, pos);
  });

  function handle(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    caret.current = raw.slice(0, e.target.selectionStart ?? raw.length).replace(/\D/g, "").length;
    onChange(raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 12));
    // Typing a separator changes no digits, so nothing else would redraw and fix the text.
    redraw((n) => n + 1);
  }

  return (
    <div className={cn("relative", wrapClassName)}>
      <Input
        ref={ref}
        inputMode="numeric"
        autoComplete="off"
        {...props}
        className={cn("pr-8 tabular-nums", className)}
        value={shown}
        onChange={handle}
      />
      <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">
        đ
      </span>
    </div>
  );
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Open dialogs, topmost last: with one dialog over another, only the top one answers the keyboard. */
const dialogStack: object[] = [];

/**
 * What a keyboard or screen-reader user needs from a dialog, in one place: focus moves in when it
 * opens, Tab stays inside while it is open, Escape closes it, and focus goes back to whatever
 * opened it. Mark the element that should take focus first with `data-autofocus`; otherwise the
 * panel itself does, so the dialog's title is read out before its first field.
 */
export function useDialog(open: boolean, panel: RefObject<HTMLElement | null>, onClose: () => void) {
  // A fresh arrow function on every render must not re-run the effect (and steal focus back).
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!open) return;
    const me = {};
    dialogStack.push(me);
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => {
      const el = panel.current;
      if (!el) return;
      (el.querySelector<HTMLElement>("[data-autofocus]") ?? el).focus({ preventScroll: true });
    });
    const onKey = (e: KeyboardEvent) => {
      if (dialogStack[dialogStack.length - 1] !== me) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        close.current();
        return;
      }
      if (e.key !== "Tab") return;
      const el = panel.current;
      if (!el) return;
      const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((n) => n.getClientRects().length > 0);
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) {
        e.preventDefault();
        el.focus();
        return;
      }
      const active = document.activeElement;
      const outside = !el.contains(active) || active === el;
      if (e.shiftKey && (active === first || outside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || (outside && active !== el))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      dialogStack.splice(dialogStack.indexOf(me), 1);
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [open, panel]);
}

/**
 * Native date picker with a readable "17 Sep 2026" overlay (Chromium ignores html lang).
 *
 * The input is transparent rather than hidden, which is what makes the overlay
 * possible — but it also means the only thing that opens the calendar natively
 * is the invisible icon glyph in its corner. Clicking anywhere else on the
 * field did nothing at all, which is exactly how the Reports "Custom from/to"
 * pair came to look broken. `showPicker()` on a click over the whole box is
 * what restores the obvious behaviour, with a real icon so there is something
 * to aim at.
 */
export function DateField({
  value,
  onChange,
  className,
  disabled,
  required,
  invalid,
  min,
  max,
  "aria-label": ariaLabel,
  "aria-describedby": describedBy,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  disabled?: boolean;
  /**
   * A date the screen cannot do without, because what it shows is loaded by it. Emptying the box
   * (Backspace on a part of it, or "Clear" in the calendar) is then not passed on: the screen keeps
   * the date it has, the box reads "Pick a date" while it is being retyped, and it goes back to the
   * real date when the person leaves it. Without this the empty string reaches `onChange`, which is
   * what a form that checks its own date wants and a screen that fetches by it does not.
   */
  required?: boolean;
  /** The server refused this date: the box is marked the way a refused text field is. */
  invalid?: boolean;
  min?: string;
  max?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  // The `value` the box was emptied from. Remembering which value (not just "emptied") means a new
  // date chosen from outside, a "Tomorrow" button say, ends the blank state without an effect.
  const [blankOf, setBlankOf] = useState<string | null>(null);
  const blank = blankOf === value;
  const bad = invalid || blank;

  const open = () => {
    const el = ref.current;
    if (!el || disabled) return;
    el.focus();
    // Safari and older Firefox have no `showPicker`; there the focus above plus
    // the native field is all we can offer, and typing still works.
    try {
      el.showPicker?.();
    } catch {
      // Chrome throws if the call is not considered user-initiated. Focus stands.
    }
  };

  return (
    <div
      role="presentation"
      onClick={open}
      className={cn(
        "relative flex h-11 min-w-[11rem] items-center gap-2 rounded-[var(--radius-sm)] border border-line bg-fill px-3 transition-[background-color,border-color,box-shadow] duration-150 ease-[var(--ease-spring)]",
        disabled
          ? "cursor-not-allowed opacity-50"
          : // The real input is see-through, so its own focus ring cannot show: draw the same ring here.
            "cursor-pointer hover:bg-fill-strong has-[:focus-visible]:border-accent/70 has-[:focus-visible]:bg-surface has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
        // Same for the red edge the global rule gives a refused field: it lands on the invisible input.
        bad && "border-danger hover:border-danger has-[:focus-visible]:border-danger",
        className,
      )}
    >
      <span className="pointer-events-none flex-1 truncate text-sm tabular-nums text-fg">
        {value && !blank ? formatDate(value) : <span className={bad ? "text-danger" : "text-subtle"}>{t("Pick a date")}</span>}
      </span>
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="pointer-events-none size-4 shrink-0 text-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      >
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M8 3v4M16 3v4M3 10h18" />
      </svg>
      <input
        ref={ref}
        type="date"
        value={blank ? "" : value}
        min={min}
        max={max}
        disabled={disabled}
        required={required}
        aria-invalid={bad || undefined}
        aria-describedby={describedBy}
        onChange={(e) => {
          const v = e.target.value;
          if (required && !v) {
            setBlankOf(value);
            return;
          }
          setBlankOf(null);
          onChange(v);
        }}
        onBlur={() => setBlankOf(null)}
        aria-label={ariaLabel ?? t("Pick a date")}
        // Still stretched over the whole field so keyboard focus lands on the
        // real control, but `opacity-0` means the overlay above is what shows.
        className="absolute inset-0 size-full cursor-pointer rounded-[var(--radius-sm)] opacity-0 disabled:cursor-not-allowed"
      />
    </div>
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      // `select-caret` draws the arrow from gradients in the muted token, so it follows light and dark.
      className={cn("select-caret h-11 w-full appearance-none px-3 pr-9", FIELD, className)}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn("w-full px-3 py-2.5 placeholder:text-subtle", FIELD, className)}
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
        "rounded-[var(--radius-lg)] bg-surface p-5 shadow-[var(--shadow-border),var(--shadow-sm)]",
        interactive &&
          "transition-[transform,box-shadow] duration-200 ease-[var(--ease-spring)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-border),var(--shadow-md)]",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Rows of one inset grouped list: a card of lines with hairlines between them, the idiom for
 * settings, account, member detail and invoices. `ListRow` takes an optional leading icon, a
 * value on the right and a chevron when the whole row goes somewhere.
 */
export function ListGroup({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("list-group", className)} {...props} />;
}

export function ListRow({
  icon: Icon,
  title,
  detail,
  value,
  chevron = false,
  onClick,
  href,
  className,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  /** A second line, smaller and muted. */
  detail?: ReactNode;
  /** What sits on the right: a figure, a badge, a switch. */
  value?: ReactNode;
  chevron?: boolean;
  onClick?: () => void;
  href?: string;
  className?: string;
}) {
  const body = (
    <>
      {Icon ? (
        <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-accent-tint text-accent-text">
          <Icon className="size-4" strokeWidth={1.9} />
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-callout text-fg">{title}</span>
        {detail ? <span className="block truncate text-footnote text-muted">{detail}</span> : null}
      </span>
      {value ? <span className="shrink-0 text-subheadline tabular-nums text-muted">{value}</span> : null}
      {chevron ? <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-faint" strokeWidth={2} /> : null}
    </>
  );
  const row = cn("flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left", className);
  if (href) {
    return (
      <a href={href} className={cn(row, "transition-colors duration-150 hover:bg-fill")}>
        {body}
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(row, "transition-colors duration-150 hover:bg-fill active:bg-fill-strong")}>
        {body}
      </button>
    );
  }
  return <div className={row}>{body}</div>;
}

type BadgeTone = "ink" | "accent" | "success" | "hold" | "info" | "muted" | "danger";

// `accent` is what statusTone calls "confirmed, active, completed": a state, not an action, so it
// is painted in the success role. The action colour is for what can be pressed.
const BADGE_TONES: Record<BadgeTone, string> = {
  ink: "bg-fg text-bg",
  accent: "bg-success-tint text-success",
  success: "bg-success-tint text-success",
  hold: "bg-warning-tint text-hold-text",
  info: "bg-info-tint text-info",
  muted: "bg-fill-strong text-muted",
  danger: "bg-danger-tint text-danger",
};
// A glyph per tone, so "paid" and "held" and "cancelled" differ in shape and not only in hue
// (a photocopy, a colour-blind reader and a projector all lose the hue).
const BADGE_GLYPH: Partial<Record<BadgeTone, LucideIcon>> = {
  accent: CheckIcon,
  success: CheckIcon,
  hold: Clock,
  info: Info,
  danger: XIcon,
  muted: Minus,
};

export function Badge({
  tone = "ink",
  icon = false,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone; icon?: boolean }) {
  const Glyph = icon ? BADGE_GLYPH[tone] : undefined;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-[var(--radius-pill)] px-2 py-0.5 text-caption font-medium tabular-nums",
        BADGE_TONES[tone],
        className,
      )}
      {...props}
    >
      {Glyph ? <Glyph aria-hidden="true" className="size-3 shrink-0" strokeWidth={2.5} /> : null}
      {children}
    </span>
  );
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge tone={statusTone(status)} icon className={className}>
      {statusLabel(status)}
    </Badge>
  );
}

export function Field({
  label,
  children,
  hint,
  tone = "danger",
}: {
  label: string;
  children: ReactNode;
  /** Validation message or helper text shown under the control. */
  hint?: string;
  tone?: "danger" | "muted";
}) {
  return (
    <label className="grid gap-1.5">
      <Label>{t(label)}</Label>
      {children}
      {hint ? (
        <span className={cn("text-xs", tone === "danger" ? "text-danger" : "text-muted")}>{t(hint)}</span>
      ) : null}
    </label>
  );
}

/**
 * A tick box as a finger-sized row: the whole line toggles it, not just the small square.
 * 44px tall on a phone, 36px with a mouse.
 */
export function Check({
  label,
  hint,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: ReactNode; hint?: ReactNode }) {
  return (
    <label className={cn("flex min-h-11 cursor-pointer items-start gap-3 py-2.5 text-sm sm:min-h-9 sm:py-1.5", className)}>
      <input type="checkbox" className="mt-0.5 size-5 shrink-0 cursor-pointer accent-[var(--color-accent)]" {...props} />
      <span className="min-w-0">
        {label}
        {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
      </span>
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


/**
 * What a panel shows when its data would not load: the reason, and a button that asks again.
 *
 * Without it a panel whose request failed kept its grey blocks for good, with the reason only in a
 * toast that faded after a few seconds. `role="alert"` so a screen reader hears it appear.
 */
export function LoadError({
  message,
  onRetry,
  id,
  title,
}: {
  message: string;
  onRetry?: () => void;
  id?: string;
  /** What did not happen, when "loaded" is the wrong word (a question that got no answer, say). */
  title?: string;
}) {
  return (
    <div
      id={id}
      role="alert"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[var(--radius-lg)] border border-hold/30 bg-hold/5 px-4 py-3 text-sm"
    >
      <div className="min-w-0 flex-1 basis-56">
        <p className="font-medium">{title ?? t("This could not be loaded.")}</p>
        <p className="mt-0.5 text-muted">{message}</p>
      </div>
      {onRetry ? (
        <Button size="sm" variant="outline" onClick={onRetry}>
          {t("Try again")}
        </Button>
      ) : null}
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
    // One line, always: on a narrow phone the segments scroll sideways instead of wrapping into a
    // second row that reads as a different control.
    // A gray track with a raised thumb: choosing a view or a filter is not "the action", so the
    // thumb is the surface colour and the accent stays for what commits.
    <div className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-[var(--radius-md)] bg-fill-strong p-0.5">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value || "all"}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={cn(
              "relative min-h-11 min-w-11 shrink-0 whitespace-nowrap rounded-[calc(var(--radius-md)-2px)] px-3 text-subheadline font-medium transition-colors duration-150 sm:min-h-9 sm:min-w-9 sm:px-4",
              active ? "font-semibold text-fg" : "text-muted hover:text-fg",
            )}
          >
            {/* The thumb travels between options on a spring, and can be redirected mid-flight. */}
            {active ? (
              reduced ? (
                <span className="absolute inset-0 rounded-[calc(var(--radius-md)-2px)] bg-surface shadow-[var(--shadow-sm)]" />
              ) : (
                <motion.span
                  layoutId={`seg-${group}`}
                  className="absolute inset-0 rounded-[calc(var(--radius-md)-2px)] bg-surface shadow-[var(--shadow-sm)]"
                  transition={SPRING.snappy}
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

/**
 * A filter that doubles as a counter: "To call 412". Pressing it narrows the list,
 * pressing another one swaps. Used above long lists so the size of each pile is
 * visible before anyone starts scrolling.
 */
export function FilterChip({
  active,
  onClick,
  label,
  count,
  tone = "default",
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  tone?: "default" | "hold";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "press inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-[var(--radius-pill)] border px-3.5 text-subheadline font-medium transition-colors duration-150 sm:min-h-9",
        active
          ? "border-accent/50 bg-accent-tint text-accent-text"
          : "border-line bg-surface text-fg hover:bg-fill",
      )}
    >
      {label}
      {count !== undefined ? (
        <span
          className={cn(
            "rounded-full px-1.5 text-caption font-semibold tabular-nums",
            active ? "bg-accent/15" : tone === "hold" ? "bg-warning-tint text-hold-text" : "bg-fill-strong text-muted",
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

/**
 * "21-40 of 1,000", rows per page, and the pages themselves: first, last, the ones around the
 * current page, gaps between. An old row is two clicks away instead of twenty presses of Next.
 * Phones get Previous / "Page 3 of 20" / Next, the numbers need more room than a phone has.
 *
 * `onPageSizeChange` adds the rows-per-page picker (pair it with `usePageState`, which remembers
 * the choice per list). A list that shrinks under the current page moves back to its last page.
 */
export function Pagination({
  offset,
  total,
  pageSize,
  onChange,
  onPageSizeChange,
  pageSizes = PAGE_SIZES,
  label,
}: {
  offset: number;
  total: number;
  pageSize: number;
  onChange: (offset: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizes?: readonly number[];
  label?: string;
}) {
  const outOfRange = total > 0 && offset >= total;
  useEffect(() => {
    if (outOfRange) onChange(lastPageOffset(total, pageSize));
  }, [outOfRange, total, pageSize, onChange]);

  if (total <= 0) return null;
  const page = Math.floor(Math.min(offset, total - 1) / pageSize) + 1;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const go = (p: number) => onChange((Math.min(Math.max(p, 1), pages) - 1) * pageSize);
  // The picker only earns its place once there is more than the smallest page to show.
  const picker = onPageSizeChange && total > Math.min(...pageSizes);

  return (
    <nav aria-label={label ?? t("Pages")} className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 text-sm text-muted">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="tabular-nums">
          {t("Showing {from}-{to} of {total}", { from, to, total: total.toLocaleString(locale()) })}
        </span>
        {picker ? (
          <label className="flex items-center gap-2">
            <span>{t("Rows per page")}</span>
            <Select
              value={String(pageSize)}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-11 w-auto min-w-[4.5rem] pr-8 tabular-nums sm:h-9"
            >
              {pageSizes.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </label>
        ) : null}
      </div>
      {pages > 1 ? (
        <div className="flex items-center gap-1">
          <PageButton label={t("First page")} disabled={page === 1} onClick={() => go(1)}>
            <ChevronsLeft aria-hidden className="size-4" />
          </PageButton>
          <PageButton label={t("Previous page")} disabled={page === 1} onClick={() => go(page - 1)}>
            <ChevronLeft aria-hidden className="size-4" />
          </PageButton>
          <span className="px-2 tabular-nums sm:hidden">{t("Page {page} of {pages}", { page, pages })}</span>
          <div className="hidden items-center gap-1 sm:flex">
            {pageWindow(page, pages).map((p, i) =>
              p === "gap" ? (
                <span key={`gap-${i}`} aria-hidden className="px-1 text-subtle">
                  …
                </span>
              ) : (
                <PageButton key={p} label={t("Page {page}", { page: p })} current={p === page} onClick={() => go(p)}>
                  {p}
                </PageButton>
              ),
            )}
          </div>
          <PageButton label={t("Next page")} disabled={page === pages} onClick={() => go(page + 1)}>
            <ChevronRight aria-hidden className="size-4" />
          </PageButton>
          <PageButton label={t("Last page")} disabled={page === pages} onClick={() => go(pages)}>
            <ChevronsRight aria-hidden className="size-4" />
          </PageButton>
        </div>
      ) : null}
    </nav>
  );
}

function PageButton({
  label,
  current = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  current?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={current ? "page" : undefined}
      disabled={disabled || current}
      onClick={onClick}
      className={cn(
        "inline-grid min-h-11 min-w-11 place-items-center rounded-[var(--radius-sm)] px-2 text-sm tabular-nums transition-colors duration-150 sm:min-h-9 sm:min-w-9",
        current
          ? "bg-accent font-semibold text-accent-fg disabled:opacity-100"
          : "border border-line-strong/70 bg-surface text-fg hover:bg-wood disabled:cursor-not-allowed disabled:opacity-40",
      )}
    >
      {children}
    </button>
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
  // Portals need a document, which the server render does not have.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // Focus in, Tab kept inside, Escape to close, focus handed back to the opener.
  useDialog(open, panel, onClose);

  // The page behind it stops scrolling while it is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  /*
   * Portalled to <body>, not rendered where it is written.
   *
   * A `position: fixed` element inside an ancestor that has a transform is
   * positioned against that ancestor instead of the viewport, and its stacking
   * is trapped there too. Every card on this app is inside an animated
   * wrapper, so a dialog opened from one was painted underneath the page
   * furniture around it — the payments filter row sat on top of the QR code a
   * customer was being asked to scan.
   *
   * `mounted` keeps this off the server render, where there is no document.
   */
  const body = mounted ? document.body : null;

  const sheet = useIsPhone();
  const reduced = useReducedMotion();
  const drag = useDragControls();
  const dragY = useMotionValue(0);

  // A sheet rises from the bottom and leaves the way it came; a dialog on a wide screen scales in
  // from just below its resting place. Under reduced motion both are a cross-fade.
  const pose = reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : sheet
      ? { initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%" } }
      : {
          initial: { opacity: 0, y: 14, scale: 0.97 },
          animate: { opacity: 1, y: 0, scale: 1 },
          exit: { opacity: 0, y: 8, scale: 0.98 },
        };

  /*
   * Releasing a dragged sheet: where it would come to rest if thrown (the finger's velocity
   * projected forward) decides, not where the finger let go, so a short flick still dismisses it
   * and a slow drag that stops halfway still springs back. Either way the spring starts from the
   * live position and the release velocity, so the hand-off has no seam.
   */
  function release(offsetY: number, velocityY: number) {
    const height = panel.current?.offsetHeight ?? 400;
    const lands = offsetY + project(velocityY);
    if (lands > height * 0.4 || velocityY > 900) onClose();
  }

  const dialog = (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-start">
          {/* Clicking the dimmed page closes the dialog. Keyboard users have Escape and the
              dialog's own buttons, so this is kept out of the tab order and the reading order.
              The page behind is pushed back: dimmed with the brand night and softly blurred. */}
          <motion.div
            role="presentation"
            aria-hidden="true"
            className="absolute inset-0 bg-scrim/45 backdrop-blur-[3px]"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="relative max-h-[88dvh] w-full overflow-y-auto rounded-t-[var(--radius-xl)] bg-surface px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-2 shadow-[var(--shadow-lg)] outline-none sm:mt-[8vh] sm:max-h-[84dvh] sm:w-[min(32rem,calc(100%-2rem))] sm:rounded-[var(--radius-xl)] sm:p-5"
            style={sheet && !reduced ? { y: dragY } : undefined}
            {...pose}
            transition={reduced ? { duration: 0.15 } : sheet ? SPRING.bouncy : SPRING.smooth}
            drag={sheet && !reduced ? "y" : false}
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            // Resists upward, follows freely downward: the rubber band at the top edge.
            dragElastic={{ top: 0.06, bottom: 0.9 }}
            onDragEnd={(_, info) => release(info.offset.y, info.velocity.y)}
          >
            {/* The grab handle and the title: the part of a sheet you pull it by. Fields and
                buttons below are never a drag handle, so selecting text still works. */}
            <div
              onPointerDown={(e) => sheet && !reduced && drag.start(e)}
              className={cn("-mx-5 px-5", sheet && !reduced && "cursor-grab touch-none active:cursor-grabbing")}
            >
              <div aria-hidden="true" className="mx-auto mb-3 mt-1 h-1 w-9 rounded-full bg-line-strong sm:hidden" />
              <h2 id={titleId} className="text-title-2 font-display">
                {t(title)}
              </h2>
            </div>
            <div className="mt-4">{children}</div>
            {footer ? <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div> : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );

  return body ? createPortal(dialog, body) : null;
}

/** True on a phone-width screen, where a modal is a bottom sheet. Settles after mount, so the server render is the dialog. */
function useIsPhone() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    setPhone(mq.matches);
    const on = (e: MediaQueryListEvent) => setPhone(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return phone;
}

/**
 * How a figure moved against the period before it.
 *
 * `good` is carried rather than derived from the sign, because whether "up" is
 * good news depends entirely on what is being counted. Revenue climbing is the
 * centre doing well; refunds climbing is the centre doing badly. Painting both
 * green for going up would tell a manager the opposite of what happened.
 */
export type Trend = {
  /** Percent change, or null when there was nothing to compare against. */
  pct: number | null;
  label: string;
  /** null when the figure did not move, or when the direction carries no verdict. */
  good: boolean | null;
};

export function Stat({
  label,
  value,
  hint,
  trend,
  icon: Icon,
  note,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  trend?: Trend;
  icon?: LucideIcon;
  /** Always-visible plain-words definition of the figure. */
  note?: string;
}) {
  const Arrow =
    trend?.pct == null || trend.pct === 0 ? Minus : trend.pct > 0 ? ArrowUpRight : ArrowDownRight;
  // A zero (or an empty "0 đ") is one quiet line, not a 36px digit that holds the place of news.
  const empty = isEmptyFigure(value) && !trend;
  return (
    <Card className={cn(empty && "py-4")}>
      <div className="flex items-center justify-between gap-2">
        <p className="kicker text-caption text-muted">{t(label)}</p>
        {Icon ? (
          <span aria-hidden="true" className="grid size-8 place-items-center rounded-[var(--radius-sm)] bg-accent-tint text-accent-text">
            <Icon className="size-4" strokeWidth={1.9} />
          </span>
        ) : null}
      </div>
      {empty ? (
        <p className="mt-1.5 text-callout text-subtle">{t("Nothing yet")}</p>
      ) : (
        <p className="figure mt-2.5 text-title-1 sm:text-large-title">{value}</p>
      )}
      {trend ? (
        <p
          className={cn(
            "mt-1.5 flex items-center gap-1 text-subheadline font-medium",
            trend.good === true && "text-success",
            trend.good === false && "text-danger",
            trend.good == null && "text-muted",
          )}
        >
          <Arrow className="size-4 shrink-0" strokeWidth={2} aria-hidden />
          {trend.label}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-sm text-muted">{t(hint)}</p>
      ) : null}
      {note ? <p className="mt-2 border-t border-line/70 pt-2 text-xs leading-snug text-muted">{t(note)}</p> : null}
    </Card>
  );
}


/**
 * For catalogue-style lists (classes, plans) where paging would be heavy: show the first few and
 * let the person ask for more. Says how many are hidden so nobody wonders if the list ended.
 */
export function ShowMore({ shown, total, step, onMore }: { shown: number; total: number; step: number; onMore: () => void }) {
  if (shown >= total) return null;
  const left = total - shown;
  return (
    <div className="mt-4 flex flex-col items-center gap-1">
      <Button variant="outline" onClick={onMore}>
        {t("Show {n} more", { n: Math.min(step, left) })}
      </Button>
      <span className="text-xs text-muted tabular-nums">
        {t("{shown} of {total} shown", { shown, total })}
      </span>
    </div>
  );
}

export { PageHero, type PageHeroStat } from "@/components/page-hero";
export { StatStrip, type StatItem } from "@/components/stat-strip";
export { EmptyState, type EmptyStateAction } from "@/components/empty-state";
export { RowActions, type RowActionItem } from "@/components/row-actions";
export { ContextLayout, ContextCard } from "@/components/context-layout";
export { useSports, SportBadge, SportDot, SportThumbnail, type SportInfo } from "@/components/sports-ui";
