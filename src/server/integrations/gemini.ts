import { readFileSync } from "node:fs";

export type ChatTurn = { role: "user" | "model"; text: string };
export type AssistantSource = "gemini" | "xai" | "rules";
// Per-call tuning. json asks for a bare JSON reply.
export type ReplyOptions = { maxOutputTokens?: number; json?: boolean };

/**
 * Gemini models tried in order, Flash family only.
 *
 * The assistant used to call one hardcoded model, and when Google closed
 * `gemini-2.5-flash` to new keys every question got a 404 that was swallowed
 * into the rule-based reply — the member saw the same canned line for every
 * question and nothing said why. Now a list: GEMINI_MODELS (comma-separated)
 * or GEMINI_MODEL overrides it, and a model that fails is skipped for a while
 * so the next one answers instead.
 */
const DEFAULT_GEMINI_MODELS = ["gemini-3.5-flash", "gemini-3.6-flash", "gemini-3.1-flash-lite"];
const XAI_MODEL = "grok-4.5";
/** One model's attempt. A Flash reply takes 4–9 s on the free tier. */
const TRY_MS = 9_000;
/** The whole question, fallbacks included: one slow answer plus a short second chance. */
const TOTAL_MS = 14_000;
/** Models asked per question. Each try spends free-tier quota (about 20 a day), so a bad hour costs two, not three. */
const MAX_MODELS_PER_ASK = 2;
const MAX_OUT = 1024;
/** Overloaded / rate-limited / timed out: try it again soon. */
const COOL_BUSY_MS = 60_000;
/** Not found / not offered to this key / request rejected: leave it alone for a long time. */
const COOL_GONE_MS = 6 * 60 * 60_000;

const coolUntil = new Map<string, number>();
/** Models that answered 400 to `thinkingConfig` and then worked without it. */
const noThinkingConfig = new Set<string>();

function readSecretFile(name: string): string | undefined {
  try {
    const v = readFileSync(`/workspace/.secrets/${name}`, "utf8").trim();
    return v || undefined;
  } catch {
    return undefined;
  }
}

export function geminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || readSecretFile("gemini");
}

function xaiApiKey(): string | undefined {
  return process.env.XAI_API_KEY?.trim();
}

/** The configured chain, de-duplicated, with model names checked so nothing odd lands in the URL. */
export function geminiModels(): string[] {
  const raw = process.env.GEMINI_MODELS?.trim() || process.env.GEMINI_MODEL?.trim();
  const list = raw ? raw.split(",") : DEFAULT_GEMINI_MODELS;
  const clean = list.map((m) => m.trim().replace(/^models\//, "")).filter((m) => /^[a-z0-9.-]{3,64}$/i.test(m));
  return [...new Set(clean.length ? clean : DEFAULT_GEMINI_MODELS)];
}

/** Models not cooling down, in order. If every one is cooling, all of them — better a try than a sure miss. */
function modelsToTry(now = Date.now()): string[] {
  const all = geminiModels();
  const ready = all.filter((m) => (coolUntil.get(m) ?? 0) <= now);
  return ready.length ? ready : all;
}

/** Test hooks: forget every cooldown, or everything learned about the models. */
export function resetGeminiCooldowns(): void {
  coolUntil.clear();
}

export function resetGeminiState(): void {
  coolUntil.clear();
  noThinkingConfig.clear();
}

type GeminiCandidate = { finishReason?: string; content?: { parts?: Array<{ text?: string; thought?: boolean }> } };

export function extractGeminiText(data: unknown): { text: string | null; finishReason: string | null; blocked: boolean } {
  if (!data || typeof data !== "object") return { text: null, finishReason: null, blocked: false };
  const blocked = Boolean((data as { promptFeedback?: { blockReason?: string } }).promptFeedback?.blockReason);
  const cands = (data as { candidates?: unknown }).candidates;
  if (!Array.isArray(cands) || !cands[0] || typeof cands[0] !== "object") return { text: null, finishReason: null, blocked };
  const c = cands[0] as GeminiCandidate;
  const text = (c.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? "").join("").trim();
  return { text: text || null, finishReason: c.finishReason ?? null, blocked };
}

/** What a failed attempt means for the rest of the chain. */
type Outcome = { kind: "ok"; text: string } | { kind: "next" } | { kind: "stop" };

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    return (body.error?.message ?? "").replace(/\s+/g, " ").slice(0, 200);
  } catch {
    return "";
  }
}

async function tryGemini(
  model: string,
  key: string,
  system: string,
  contents: unknown[],
  opts: ReplyOptions,
  deadline: number,
  thinkingOff = !noThinkingConfig.has(model),
): Promise<Outcome> {
  const maxOut = opts.maxOutputTokens ?? MAX_OUT;
  // Thinking is switched off where the model allows it, so it cannot eat the
  // output budget and cut the answer short. A model that refuses the setting
  // is asked without it, with room for its thoughts.
  const ms = Math.min(TRY_MS, deadline - Date.now());
  if (ms < 1_500) return { kind: "stop" };
  let res: Response;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      signal: AbortSignal.timeout(ms),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: thinkingOff ? maxOut : maxOut * 2,
          ...(thinkingOff ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          ...(opts.json ? { responseMimeType: "application/json" } : {}),
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
        ],
      }),
    });
  } catch (e) {
    const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    console.warn(`[assistant] gemini ${model} ${timedOut ? `timeout after ${ms} ms` : "network error"}`);
    coolUntil.set(model, Date.now() + COOL_BUSY_MS);
    return { kind: "next" };
  }

  if (!res.ok) {
    const msg = await errorMessage(res);
    console.warn(`[assistant] gemini ${model} ${res.status}${msg ? `: ${msg}` : ""}`);
    if (res.status === 400 && thinkingOff) {
      // Often the thinking setting. Ask once more without it, and remember
      // that only if it then works — a 400 for any other reason must not
      // turn thinking back on for good.
      const again = await tryGemini(model, key, system, contents, opts, deadline, false);
      if (again.kind === "ok") noThinkingConfig.add(model);
      return again;
    }
    // 401/403 with "API key" is the key, not the model: every model would say the same.
    if ((res.status === 401 || res.status === 403) && /api key|permission|unauthori[sz]ed/i.test(msg) && !/model/i.test(msg)) {
      return { kind: "stop" };
    }
    const busy = res.status === 429 || res.status >= 500;
    coolUntil.set(model, Date.now() + (busy ? COOL_BUSY_MS : COOL_GONE_MS));
    return { kind: "next" };
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    console.warn(`[assistant] gemini ${model} unreadable reply`);
    return { kind: "next" };
  }
  const { text, finishReason, blocked } = extractGeminiText(data);
  if (blocked || finishReason === "SAFETY" || finishReason === "PROHIBITED_CONTENT" || finishReason === "BLOCKLIST") {
    // The question itself was refused; another model is unlikely to differ. Rules answer it.
    console.warn(`[assistant] gemini ${model} blocked (${finishReason ?? "prompt"})`);
    return { kind: "stop" };
  }
  if (finishReason && finishReason !== "STOP") {
    // MAX_TOKENS and the like: a cut-off sentence reads as a wrong answer.
    console.warn(`[assistant] gemini ${model} finishReason ${finishReason}`);
    coolUntil.set(model, Date.now() + COOL_BUSY_MS);
    return { kind: "next" };
  }
  if (!text) {
    console.warn(`[assistant] gemini ${model} empty reply`);
    coolUntil.set(model, Date.now() + COOL_BUSY_MS);
    return { kind: "next" };
  }
  coolUntil.delete(model);
  return { kind: "ok", text };
}

async function callGemini(system: string, turns: ChatTurn[], opts: ReplyOptions, deadline: number): Promise<string | null> {
  const key = geminiApiKey();
  if (!key) return null;
  const contents = turns
    .filter((t) => t.text.trim().length > 0)
    .map((t) => ({ role: t.role === "model" ? "model" : "user", parts: [{ text: t.text.slice(0, 2000) }] }));
  while (contents.length && contents[0]?.role !== "user") contents.shift();
  if (!contents.length) return null;

  for (const model of modelsToTry().slice(0, MAX_MODELS_PER_ASK)) {
    const out = await tryGemini(model, key, system, contents, opts, deadline);
    if (out.kind === "ok") return out.text;
    if (out.kind === "stop") return null;
  }
  return null;
}

async function callXai(system: string, turns: ChatTurn[], opts: ReplyOptions, deadline: number): Promise<string | null> {
  const key = xaiApiKey();
  if (!key) return null;
  const ms = Math.min(TRY_MS, deadline - Date.now());
  if (ms < 1_500) return null;
  const messages = [
    { role: "system", content: system },
    ...turns.map((t) => ({
      role: t.role === "model" ? "assistant" : "user",
      content: t.text.slice(0, 2000),
    })),
  ];
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(ms),
    body: JSON.stringify({
      model: XAI_MODEL,
      messages,
      temperature: 0.35,
      max_tokens: opts.maxOutputTokens ?? MAX_OUT,
    }),
  });
  if (!res.ok) {
    console.warn(`[assistant] xai ${res.status}`);
    return null;
  }
  const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = body.choices?.[0]?.message?.content?.trim();
  return text || null;
}

export async function generateAssistantReply(
  system: string,
  turns: ChatTurn[],
  opts: ReplyOptions = {},
): Promise<{ text: string; source: Exclude<AssistantSource, "rules"> } | null> {
  const deadline = Date.now() + TOTAL_MS;
  try {
    const gemini = await callGemini(system, turns, opts, deadline);
    if (gemini) return { text: gemini, source: "gemini" };
  } catch (e) {
    console.warn("[assistant] gemini error", e instanceof Error ? e.message : "fail");
  }
  try {
    const xai = await callXai(system, turns, opts, deadline);
    if (xai) return { text: xai, source: "xai" };
  } catch (e) {
    console.warn("[assistant] xai error", e instanceof Error ? e.message : "fail");
  }
  return null;
}
