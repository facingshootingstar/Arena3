import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * A seal on each AI reply, so the browser can send the thread back and the
 * server can tell its own past answers from ones a browser made up.
 *
 * The server used to drop every assistant turn the browser sent, because a
 * browser that may write the assistant's past can talk the model into a
 * discount or a free court that does not exist. With only the member's turns
 * left, the model saw a row of unanswered questions and answered the oldest
 * one again. A reply now comes back with `sig` = HMAC(member, question, reply):
 * only a question → answer pair whose seal checks out reaches the model, so a
 * real answer cannot be glued onto a different question either.
 *
 * The key is ASSISTANT_SECRET (or OTP_SECRET) when set. Without one it is
 * random per process: a restart, or a second server, then only makes old
 * threads start fresh — the behaviour before this change, not a hole — and
 * production says so once in the log.
 */
const CONFIGURED = process.env.ASSISTANT_SECRET?.trim() || process.env.OTP_SECRET?.trim();
const KEY = CONFIGURED || randomBytes(32).toString("hex");
if (!CONFIGURED && process.env.NODE_ENV === "production") {
  console.warn("[assistant] ASSISTANT_SECRET is not set: conversation context will not survive a restart or reach a second server");
}

/** Longest assistant turn accepted back. Replies are capped to this before they are sealed. */
export const MAX_BOT_TURN = 4000;

function mac(userId: string, question: string, reply: string): Buffer {
  return createHmac("sha256", KEY)
    .update(JSON.stringify(["assistant:v2", userId, question, reply]))
    .digest()
    .subarray(0, 18);
}

export function signReply(userId: string, question: string, reply: string): string {
  return mac(userId, question, reply).toString("base64url");
}

export function verifyReply(userId: string, question: string, reply: string, sig: unknown): boolean {
  if (typeof sig !== "string" || sig.length !== 24 || reply.length > MAX_BOT_TURN) return false;
  const got = Buffer.from(sig, "base64url");
  const want = mac(userId, question, reply);
  return got.length === want.length && timingSafeEqual(got, want);
}
