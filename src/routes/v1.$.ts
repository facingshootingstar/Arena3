import { createFileRoute } from "@tanstack/react-router";
import { handleApi } from "@/lib/arena3/router";

const SPRING_BOOT_URL = process.env.SPRING_BOOT_URL || "http://localhost:8088";

async function forwardOrFallback(request: Request) {
  // A Request body can only be read once, and proxying to Spring Boot reads it.
  // Buffer it up front so the in-process fallback gets its own readable copy —
  // handing it the drained original made every POST/PUT/PATCH/DELETE 500 with
  // "Body is unusable" whenever the backend was down or returned 404.
  const hasBody = !["GET", "HEAD"].includes(request.method);
  const body = hasBody ? await request.arrayBuffer() : undefined;
  const fallback = () =>
    handleApi(
      hasBody
        ? new Request(request.url, { method: request.method, headers: request.headers, body })
        : request,
    );

  try {
    const url = new URL(request.url);
    const targetUrl = `${SPRING_BOOT_URL}${url.pathname}${url.search}`;
    const headers = new Headers(request.headers);
    headers.delete("host");
    const res = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
    });
    if (res.status === 404) {
      return fallback();
    }
    return res;
  } catch {
    return fallback();
  }
}

export const Route = createFileRoute("/v1/$")({
  server: {
    handlers: {
      GET: ({ request }) => forwardOrFallback(request),
      POST: ({ request }) => forwardOrFallback(request),
      PATCH: ({ request }) => forwardOrFallback(request),
      PUT: ({ request }) => forwardOrFallback(request),
      DELETE: ({ request }) => forwardOrFallback(request),
    },
  },
});
