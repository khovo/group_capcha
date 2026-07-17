import type { Env, TgUpdate } from "./types";
import { tg } from "./telegram";
import { getSettings, setPendingCaptcha, getPendingCaptcha, deletePendingCaptcha, markJoined, listExpiredPending } from "./storage";
import { generateCaptcha, buildCaptchaKeyboard } from "./captcha";
import { handleCommand } from "./commands";
import { moderateMessage } from "./spamFilter";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Group Guard bot is running.", { status: 200 });
    }

    // Verify the request really came from Telegram.
    const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (secret !== env.WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    let update: TgUpdate;
    try {
      update = await request.json();
    } catch {
      return new Response("Bad request", { status: 400 });
    }

    try {
      await routeUpdate(env, update);
    } catch (err) {
      console.error("Error handling update:", err);
    }

    // Always 200 so Telegram doesn't retry-storm us.
    return new Response("OK", { status: 200 });
  },

  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    const expired = await listExpiredPending(env);
    for (const entry of expired) {
      await tg.declineChatJoinRequest(env, entry.chatId, entry.userId);
      await deletePendingCaptcha(env, entry.chatId, entry.userId);
    }
  },
};

async function routeUpdate(env: Env, update: TgUpdate): Promise<void> {
  if (update.chat_join_request) {
    await handleJoinRequest(env, update);
    return;
  }
  if (update.callback_query) {
    await handleCallback(env, update);
    return;
  }
  if (update.message) {
    const settings = await getSettings(env, update.message.chat.id);
    const handled = await moderateMessage(env, update.message, settings);
    if (!handled && update.message.text?.startsWith("/")) {
      await handleCommand(env, update.message);
    }
  }
}

async function handleJoinRequest(env: Env, update: TgUpdate): Promise<void> {
  const req = update.chat_join_request!;
  const chatId = req.chat.id;
  const userId = req.from.id;
  const settings = await getSettings(env, chatId);

  if (!settings.captchaEnabled) {
    await tg.approveChatJoinRequest(env, chatId, userId);
    return;
  }

  const challenge = generateCaptcha();
  const expiresAt = Math.floor(Date.now() / 1000) + settings.timeoutSeconds;

  await setPendingCaptcha(env, {
    chatId,
    userId,
    chatTitle: req.chat.title ?? "the group",
    correctAnswer: challenge.correctAnswer,
    createdAt: Math.floor(Date.now() / 1000),
    expiresAt,
  });

  // This DM works because Telegram allows a bot to message a user who has an
  // open join request against a chat where the bot is admin. If it fails
  // (e.g. user has blocked the bot), tell group admins in the README how to
  // require /start first via the invite link's bot deep-link.
  await tg.sendMessage(
    env,
    userId,
    `👋 Hi ${req.from.first_name}! To join <b>${escapeHtml(req.chat.title ?? "the group")}</b>, please solve this to prove you're human:\n\n<b>${challenge.question}</b>\n\nYou have ${Math.round(settings.timeoutSeconds / 60)} minute(s).`,
    { reply_markup: buildCaptchaKeyboard(chatId, userId, challenge) }
  );
}

async function handleCallback(env: Env, update: TgUpdate): Promise<void> {
  const cb = update.callback_query!;
  if (!cb.data?.startsWith("cap:")) return;

  const [, chatIdStr, userIdStr, answerStr] = cb.data.split(":");
  const chatId = Number(chatIdStr);
  const userId = Number(userIdStr);
  const submitted = Number(answerStr);

  if (cb.from.id !== userId) {
    await tg.answerCallbackQuery(env, cb.id, "This captcha isn't for you.", true);
    return;
  }

  const pending = await getPendingCaptcha(env, chatId, userId);
  if (!pending) {
    await tg.answerCallbackQuery(env, cb.id, "This captcha already expired.", true);
    return;
  }

  if (submitted !== pending.correctAnswer) {
    await tg.answerCallbackQuery(env, cb.id, "❌ Wrong answer, try again.", true);
    return;
  }

  await tg.approveChatJoinRequest(env, chatId, userId);
  await deletePendingCaptcha(env, chatId, userId);

  const settings = await getSettings(env, chatId);
  await markJoined(env, chatId, userId, settings.probationMinutes);

  await tg.answerCallbackQuery(env, cb.id, "✅ Verified! You're in.");
  if (cb.message) {
    await tg.editMessageText(
      env,
      cb.message.chat.id,
      cb.message.message_id,
      settings.welcomeMessage.replace("{name}", cb.from.first_name)
    );
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
