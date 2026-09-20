import { Link, type ErrorComponentProps } from "@tanstack/react-router";
import { Compass, TriangleAlert } from "lucide-react";

const FALLBACK_MESSAGE = "An unexpected error occurred. Try reloading the page.";

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return FALLBACK_MESSAGE;
}

export function AppErrorComponent({ error }: ErrorComponentProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-6 text-center text-ink">
      <span className="text-danger" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="font-display text-2xl">Something went wrong</h1>
      <p className="max-w-md text-sm break-words text-muted">{errorMessage(error)}</p>
    </main>
  );
}

/**
 * The page for a URL that does not exist.
 *
 * Without one, TanStack renders its own `<p>Not Found</p>` — no styling, no
 * nav, and nothing to click. A mistyped address, a stale bookmark or a member
 * link that has since moved all landed a visitor on a blank white page with no
 * way back into the centre.
 */
export function AppNotFoundComponent() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-6 text-center text-ink">
      <span className="text-muted" aria-hidden="true">
        <Compass className="size-10" strokeWidth={1.5} />
      </span>
      <h1 className="font-display text-3xl">This page isn&rsquo;t here</h1>
      <p className="max-w-md text-sm text-muted">
        The address may have changed, or the link that brought you here is out of date.
      </p>
      <Link
        to="/"
        className="mt-2 rounded-[var(--radius-lg)] bg-accent px-5 py-2.5 text-sm font-medium text-accent-fg"
      >
        Back to Arena3
      </Link>
    </main>
  );
}
