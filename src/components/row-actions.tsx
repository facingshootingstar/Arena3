import {
  useState,
  useRef,
  useEffect,
  type ComponentType,
} from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";

export type RowActionItem = {
  label: string;
  onClick: () => void;
  icon?: ComponentType<{ className?: string }>;
  danger?: boolean;
  disabled?: boolean;
  confirm?: string;
  confirmMessage?: string;
};

export function RowActions({
  primary,
  secondary,
  className,
}: {
  primary?: {
    label: string;
    onClick: () => void;
    icon?: ComponentType<{ className?: string }>;
    disabled?: boolean;
    title?: string;
  };
  secondary?: RowActionItem[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const PrimaryIcon = primary?.icon;

  return (
    <div className={cn("relative inline-flex items-center gap-1.5", className)}>
      {primary ? (
        <button
          type="button"
          onClick={primary.onClick}
          disabled={primary.disabled}
          title={primary.title}
          className="press inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-[var(--radius-sm)] bg-fill-strong px-3 text-footnote font-medium text-fg transition-colors hover:bg-[color-mix(in_oklab,var(--color-fg)_14%,transparent)] disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-8"
        >
          {PrimaryIcon ? <PrimaryIcon className="size-3.5 text-muted" /> : null}
          <span>{primary.label}</span>
        </button>
      ) : null}

      {secondary && secondary.length > 0 ? (
        <div ref={menuRef} className="relative inline-block text-left">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-haspopup="true"
            aria-label={t("More actions")}
            className={cn(
              "press inline-flex size-11 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] text-muted transition-colors hover:bg-fill-strong hover:text-fg sm:size-8",
              open && "bg-fill-strong text-fg",
            )}
          >
            <MoreHorizontal className="size-4" />
          </button>

          {open ? (
            <div
              role="menu"
              className="material-thick absolute right-0 top-full z-50 mt-1 min-w-[10rem] origin-top-right rounded-[var(--radius-md)] border border-line p-1 shadow-[var(--shadow-lg)] animate-in fade-in zoom-in-95 duration-100"
            >
              {secondary.map((item, idx) => {
                const ItemIcon = item.icon;
                const handleClick = () => {
                  setOpen(false);
                  const confirmMsg = item.confirmMessage ?? item.confirm;
                  if (confirmMsg) {
                    if (window.confirm(confirmMsg)) {
                      item.onClick();
                    }
                  } else {
                    item.onClick();
                  }
                };

                return (
                  <button
                    key={idx}
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    onClick={handleClick}
                    className={cn(
                      "flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-[var(--radius-xs)] px-2.5 text-left text-footnote font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-9",
                      item.danger
                        ? "text-danger hover:bg-danger-tint"
                        : "text-fg hover:bg-fill-strong",
                    )}
                  >
                    {ItemIcon ? (
                      <ItemIcon
                        className={cn("size-3.5", item.danger ? "text-danger" : "text-muted")}
                      />
                    ) : null}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
