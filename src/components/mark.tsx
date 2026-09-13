import { cn } from "@/lib/cn";

export function ArenaMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <rect width="32" height="32" rx="8" className="fill-fg" />
      <rect x="7" y="7" width="18" height="18" fill="none" className="stroke-bg" strokeWidth="1.7" />
      <line x1="16" y1="7" x2="16" y2="25" className="stroke-bg" strokeWidth="1.7" />
      <rect x="7" y="15.1" width="18" height="1.8" className="fill-accent" />
    </svg>
  );
}

export function CourtBackdrop({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 280" className={cn("text-accent", className)} aria-hidden>
      <rect x="18" y="12" width="164" height="256" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.35" />
      <line x1="100" y1="12" x2="100" y2="268" stroke="currentColor" strokeWidth="2" opacity="0.35" />
      <rect x="18" y="132" width="164" height="16" fill="currentColor" opacity="0.28" />
      <rect x="40" y="12" width="48" height="80" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.28" />
      <rect x="112" y="12" width="48" height="80" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.28" />
      <rect x="40" y="188" width="48" height="80" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.28" />
      <rect x="112" y="188" width="48" height="80" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.28" />
    </svg>
  );
}
