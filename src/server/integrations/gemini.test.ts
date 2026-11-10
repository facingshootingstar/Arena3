import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { generateAssistantReply, geminiModels, resetGeminiCooldowns, resetGeminiState } from "./gemini";
import { signReply, verifyReply } from "../services/assistant-thread";

/**
 * The model chain without the network: `fetch` is swapped for a script of
 * replies per model, and each test reads back which models were asked.
 */
type Script = Record<string, Array<{ status: number; body: unknown }>>;

const realFetch = globalThis.fetch;
const env = { ...process.env };
let calls: Array<{ model: string; thinking: boolean }> = [];

function script(s: Script) {
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const model = String(url).match(/models\/([^:]+):/)?.[1] ?? "?";
    const body = JSON.parse(String(init?.body ?? "{}")) as { generationConfig?: { thinkingConfig?: unknown } };
    calls.push({ model, thinking: Boolean(body.generationConfig?.thinkingConfig) });
    const next = s[model]?.shift() ?? { status: 404, body: { error: { message: "not scripted" } } };
    return new Response(JSON.stringify(next.body), { status: next.status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

const ok = (text: string, finishReason = "STOP") => ({
  status: 200,
  body: { candidates: [{ finishReason, content: { parts: [{ text }] } }] },
});

beforeEach(() => {
  calls = [];
  resetGeminiState();
  process.env.GEMINI_API_KEY = "test-key";
  process.env.GEMINI_MODELS = "m-a,m-b,m-c";
  delete process.env.XAI_API_KEY;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  process.env = { ...env };
});

const resetCooldownOnly = () => resetGeminiCooldowns();
const ask = () => generateAssistantReply("sys", [{ role: "user", text: "hi" }]);

describe("gemini model chain", () => {
  it("reads the chain from GEMINI_MODELS and drops names that do not belong in a URL", () => {
    process.env.GEMINI_MODELS = " models/m-a , m-b ,m-a, bad/../x ";
    assert.deepEqual(geminiModels(), ["m-a", "m-b"]);
    delete process.env.GEMINI_MODELS;
    process.env.GEMINI_MODEL = "only-one";
    assert.deepEqual(geminiModels(), ["only-one"]);
  });

  it("moves on when a model is gone, and skips it on the next question", async () => {
    script({ "m-a": [{ status: 404, body: { error: { message: "no longer available" } } }], "m-b": [ok("one"), ok("two")] });
    assert.deepEqual(await ask(), { text: "one", source: "gemini" });
    assert.deepEqual(await ask(), { text: "two", source: "gemini" });
    assert.deepEqual(calls.map((c) => c.model), ["m-a", "m-b", "m-b"]);
  });

  it("asks at most two models per question, and starts the next question at the one still up", async () => {
    script({ "m-a": [{ status: 503, body: {} }], "m-b": [ok("half a sent", "MAX_TOKENS")], "m-c": [ok("whole")] });
    assert.equal(await ask(), null);
    assert.deepEqual(await ask(), { text: "whole", source: "gemini" });
    assert.deepEqual(calls.map((c) => c.model), ["m-a", "m-b", "m-c"]);
  });

  it("asks a model again without thinkingConfig when it rejects the setting", async () => {
    script({ "m-a": [{ status: 400, body: { error: { message: "invalid argument" } } }, ok("fine")] });
    assert.deepEqual(await ask(), { text: "fine", source: "gemini" });
    assert.deepEqual(calls, [{ model: "m-a", thinking: true }, { model: "m-a", thinking: false }]);
  });

  it("keeps thinking off when a 400 had another cause", async () => {
    script({
      "m-a": [{ status: 400, body: {} }, { status: 400, body: {} }, ok("later")],
      "m-b": [ok("now")],
    });
    assert.deepEqual(await ask(), { text: "now", source: "gemini" });
    resetCooldownOnly();
    assert.deepEqual(await ask(), { text: "later", source: "gemini" });
    assert.equal(calls.at(-1)?.thinking, true);
  });

  it("stops at a bad key instead of asking every model", async () => {
    script({ "m-a": [{ status: 403, body: { error: { message: "API key not valid" } } }] });
    assert.equal(await ask(), null);
    assert.equal(calls.length, 1);
  });

  it("returns null with no key, so the rules answer", async () => {
    delete process.env.GEMINI_API_KEY;
    script({});
    assert.equal(await ask(), null);
    assert.equal(calls.length, 0);
  });
});

describe("assistant thread seal", () => {
  it("accepts the server's own answer, to the same question, for the same member only", () => {
    const sig = signReply("u1", "Is BC2 free at 18:00?", "Yes, BC2 is free at 18:00.");
    assert.equal(verifyReply("u1", "Is BC2 free at 18:00?", "Yes, BC2 is free at 18:00.", sig), true);
    assert.equal(verifyReply("u2", "Is BC2 free at 18:00?", "Yes, BC2 is free at 18:00.", sig), false);
    assert.equal(verifyReply("u1", "Is BC2 free of charge?", "Yes, BC2 is free at 18:00.", sig), false);
    assert.equal(verifyReply("u1", "Is BC2 free at 18:00?", "Yes, and it is free of charge.", sig), false);
    assert.equal(verifyReply("u1", "Is BC2 free at 18:00?", "Yes, BC2 is free at 18:00.", undefined), false);
  });
});
