import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { Badge, ButtonLink } from "@/components/ui";
import { money } from "@/components/shell";

/**
 * Where the till stands, in one line: is a shift open, what is in the drawer, how many payments
 * are waiting. It replaces a row of four tiles that held a "0", a "No open shift" and a "0 đ" at
 * 36px. A closed till says so once and offers the one thing to do about it; an open one says what
 * is in it. Nothing is drawn for what is zero.
 */
export function ShiftStatus({
  open,
  cash,
  waiting,
  className,
}: {
  open: boolean;
  cash?: number;
  waiting: number;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center gap-x-5 gap-y-2 rounded-[var(--radius-lg)] bg-surface px-4 py-3 shadow-[var(--shadow-border),var(--shadow-sm)]",
        className,
      )}
    >
      <span className="flex items-center gap-2 text-subheadline font-semibold">
        <span aria-hidden="true" className="relative flex size-2.5">
          {open ? <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" /> : null}
          <span className={cn("relative inline-flex size-2.5 rounded-full", open ? "bg-success" : "bg-faint")} />
        </span>
        {open ? t("Shift open") : t("No open shift")}
      </span>
      {open && cash ? (
        <span className="text-subheadline text-muted">
          {t("Cash in till")} <span className="font-semibold tabular-nums text-fg">{money(cash)}</span>
        </span>
      ) : null}
      <span className="ml-auto flex flex-wrap items-center gap-2">
        {waiting > 0 ? (
          <Link
            to="/desk/payments"
            className="hit inline-flex items-center gap-1.5 text-subheadline font-medium text-fg hover:underline"
          >
            {t("Waiting payments")}
            <Badge tone="hold">{waiting}</Badge>
          </Link>
        ) : null}
        {!open ? (
          <ButtonLink to="/desk" variant="tinted" size="sm">
            {t("Open shift")}
          </ButtonLink>
        ) : null}
      </span>
    </div>
  );
}
