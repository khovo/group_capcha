import type { Env, GroupSettings, PendingCaptcha } from "./types";
import { DEFAULT_SETTINGS } from "./types";

const settingsKey = (chatId: number) => `cfg:${chatId}`;
const pendingKey = (chatId: number, userId: number) => `pend:${chatId}:${userId}`;
const joinedKey = (chatId: number, userId: number) => `joined:${chatId}:${userId}`;

export async function getSettings(env: Env, chatId: number): Promise<GroupSettings> {
  const raw = await env.BOT_KV.get(settingsKey(chatId));
  if (!raw) return { ...DEFAULT_SETTINGS };
  return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
}

export async function saveSettings(env: Env, chatId: number, settings: GroupSettings): Promise<void> {
  await env.BOT_KV.put(settingsKey(chatId), JSON.stringify(settings));
}

export async function setPendingCaptcha(env: Env, entry: PendingCaptcha): Promise<void> {
  const ttl = Math.max(60, entry.expiresAt - Math.floor(Date.now() / 1000) + 30);
  await env.BOT_KV.put(pendingKey(entry.chatId, entry.userId), JSON.stringify(entry), { expirationTtl: ttl });
}

export async function getPendingCaptcha(env: Env, chatId: number, userId: number): Promise<PendingCaptcha | null> {
  const raw = await env.BOT_KV.get(pendingKey(chatId, userId));
  return raw ? (JSON.parse(raw) as PendingCaptcha) : null;
}

export async function deletePendingCaptcha(env: Env, chatId: number, userId: number): Promise<void> {
  await env.BOT_KV.delete(pendingKey(chatId, userId));
}

export async function markJoined(env: Env, chatId: number, userId: number, probationMinutes: number): Promise<void> {
  await env.BOT_KV.put(joinedKey(chatId, userId), String(Date.now()), {
    expirationTtl: probationMinutes * 60 + 60,
  });
}

// Returns true if the user is still inside their "new member" probation window.
export async function isOnProbation(env: Env, chatId: number, userId: number, probationMinutes: number): Promise<boolean> {
  const raw = await env.BOT_KV.get(joinedKey(chatId, userId));
  if (!raw) return false;
  const joinedAt = Number(raw);
  return Date.now() - joinedAt < probationMinutes * 60 * 1000;
}

// List all pending captcha keys (used by the cron cleanup job).
// Cloudflare KV list() is eventually consistent but fine for a 5-min sweep.
export async function listExpiredPending(env: Env): Promise<PendingCaptcha[]> {
  const now = Math.floor(Date.now() / 1000);
  const expired: PendingCaptcha[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.BOT_KV.list({ prefix: "pend:", cursor });
    for (const key of page.keys) {
      const raw = await env.BOT_KV.get(key.name);
      if (!raw) continue;
      const entry = JSON.parse(raw) as PendingCaptcha;
      if (entry.expiresAt <= now) expired.push(entry);
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return expired;
}
