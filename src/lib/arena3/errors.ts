export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT_SLOT"
  | "HOLD_EXPIRED"
  | "CONFLICT_STATE"
  | "BR_VIOLATION"
  | "VALIDATION"
  | "RATE_LIMITED";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    message: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }

  body(): Record<string, unknown> {
    return { code: this.code, message: this.message, ...this.extra };
  }
}

export const err = {
  unauth: (msg = "Please sign in.") => new ApiError(401, "UNAUTHENTICATED", msg),
  forbidden: (msg = "You do not have permission.") => new ApiError(403, "FORBIDDEN", msg),
  notFound: (msg = "Not found.") => new ApiError(404, "NOT_FOUND", msg),
  conflictSlot: (msg = "That slot is already held.", extra: Record<string, unknown> = {}) =>
    new ApiError(409, "CONFLICT_SLOT", msg, extra),
  holdExpired: (msg = "Your hold has expired.") => new ApiError(409, "HOLD_EXPIRED", msg),
  conflictState: (msg = "That is not a valid state.") => new ApiError(409, "CONFLICT_STATE", msg),
  br: (br: string, message: string, extra: Record<string, unknown> = {}) =>
    new ApiError(422, "BR_VIOLATION", message, { br, ...extra }),
  validation: (message: string, extra: Record<string, unknown> = {}) =>
    new ApiError(422, "VALIDATION", message, extra),
  rateLimited: (msg = "Too many attempts — try again later.") => new ApiError(429, "RATE_LIMITED", msg),
};

export function isConflictSlot(e: unknown): boolean {
  const x = e as { code?: string; message?: string };
  const msg = `${x?.code ?? ""} ${x?.message ?? ""}`;
  return x?.code === "23P01" || msg.includes("CONFLICT_SLOT");
}

export function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

export function handleError(e: unknown): Response {
  if (e instanceof ApiError) return json(e.status, e.body());
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("CONFLICT_SLOT") || (e as { code?: string })?.code === "23P01") {
    return json(409, { code: "CONFLICT_SLOT", message: "That slot is already held." });
  }
  if (msg.includes("HOLD_EXPIRED")) {
    return json(409, { code: "HOLD_EXPIRED", message: "Your hold has expired." });
  }
  console.error("[arena3]", e);
  return json(500, { code: "VALIDATION", message: "Something went wrong on our side." });
}
