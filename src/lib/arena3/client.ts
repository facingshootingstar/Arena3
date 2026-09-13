const TOKEN_KEY = "arena3.token";
const USER_KEY = "arena3.user";

export type Role = "manager" | "coach" | "receptionist" | "member";

export type SessionUser = {
  id: string;
  member_code: string | null;
  full_name: string;
  phone: string;
  email: string | null;
  role: Role;
  status: string;
  date_of_birth: string | null;
  health_notes: string | null;
  must_change_password: boolean;
};

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function setSession(token: string, user: SessionUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function homeFor(role: Role): string {
  if (role === "manager") return "/manager";
  if (role === "receptionist") return "/desk";
  if (role === "coach") return "/coach";
  return "/app";
}

export type ApiErrorBody = {
  code: string;
  message: string;
  br?: string;
  requires_confirm?: boolean;
};

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public body: ApiErrorBody,
  ) {
    super(body.message);
  }
}

function newIdem(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random()}`;
}

export async function api<T>(
  path: string,
  init: RequestInit & { idempotent?: boolean } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type") && init.body) headers.set("content-type", "application/json");
  const token = getToken();
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (init.idempotent) headers.set("idempotency-key", newIdem());
  const res = await fetch(`/v1${path}`, { ...init, headers });
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/pdf")) {
    return (await res.blob()) as T;
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiClientError(res.status, data);
  return data as T;
}

export const apiGet = <T>(path: string) => api<T>(path);
export const apiPost = <T>(path: string, body?: unknown, idempotent = false) =>
  api<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined, idempotent });
export const apiPatch = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined });
export const apiPut = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined });
export const apiDelete = <T>(path: string) => api<T>(path, { method: "DELETE" });
export async function openInvoice(id: string) {
  const blob = await api<Blob>(`/invoices/${id}.pdf`);
  const url = URL.createObjectURL(blob as Blob);
  window.open(url, "_blank");
}
