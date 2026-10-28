import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui";

/**
 * A button that opens a small panel of controls: the home for what a screen needs once in a while
 * (a view, a date, a code) so the row above its main content stays one row. A disclosure, not an
 * ARIA menu: Tab walks through it, Escape closes it and hands focus back, and an outside press
 * closes it. The panel is a material, so it reads as floating chrome over the page.
 */
export function Popover({
  label,
  icon,
  badge,
  align = "left",
  children,
  className,
}: {
  label: string;
  icon?: ReactNode;
  /** A short value shown on the button when something inside is set ("1 filter", a code). */
  badge?: ReactNode;
  align?: "left" | "right";
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={box} className={cn("relative", className)}>
      <Button
        ref={button}
        variant="gray"
        size="sm"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        {icon}
        {label}
        {badge ? <span className="rounded-full bg-accent-tint px-1.5 text-caption font-semibold text-accent-text">{badge}</span> : null}
        <ChevronDown aria-hidden="true" className={cn("size-3.5 transition-transform duration-200", open && "rotate-180")} />
      </Button>
      {open ? (
        <div
          id={panelId}
          className={cn(
            "material-thick absolute top-full z-30 mt-1.5 w-[min(20rem,calc(100vw-2rem))] rounded-[var(--radius-lg)] border border-line p-3 shadow-[var(--shadow-lg)]",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
