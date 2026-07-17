import type { Env } from "./types";

const API_BASE = "https://api.telegram.org/bot";

async function call<T = unknown>(env: Env, method: string, payload: Record<string, unknown>): Promise<T> {
  const url = `${API_BASE}${env.TELEGRAM_BOT_TOKEN}/${method}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as { ok: boolean; [key: string]: unknown };
  if (!data.ok) {
    console.error(`Telegram API error on ${method}:`, JSON.stringify(data));
  }
  return data as T;
}

export const tg = {
  sendMessage: (env: Env, chatId: number, text: string, extra: Record<string, unknown> = {}) =>
    call(env, "sendMessage", { chat_id: chatId, text, parse_mode: "HTML", ...extra }),

  editMessageText: (env: Env, chatId: number, messageId: number, text: string, extra: Record<string, unknown> = {}) =>
    call(env, "editMessageText", { chat_id: chatId, message_id: messageId, text, parse_mode: "HTML", ...extra }),

  deleteMessage: (env: Env, chatId: number, messageId: number) =>
    call(env, "deleteMessage", { chat_id: chatId, message_id: messageId }),

  answerCallbackQuery: (env: Env, callbackQueryId: string, text?: string, showAlert = false) =>
    call(env, "answerCallbackQuery", { callback_query_id: callbackQueryId, text, show_alert: showAlert }),

  approveChatJoinRequest: (env: Env, chatId: number, userId: number) =>
    call(env, "approveChatJoinRequest", { chat_id: chatId, user_id: userId }),

  declineChatJoinRequest: (env: Env, chatId: number, userId: number) =>
    call(env, "declineChatJoinRequest", { chat_id: chatId, user_id: userId }),

  banChatMember: (env: Env, chatId: number, userId: number, untilDate?: number) =>
    call(env, "banChatMember", { chat_id: chatId, user_id: userId, until_date: untilDate }),

  restrictChatMember: (env: Env, chatId: number, userId: number, permissions: Record<string, boolean>, untilDate?: number) =>
    call(env, "restrictChatMember", { chat_id: chatId, user_id: userId, permissions, until_date: untilDate }),

  getChatMember: (env: Env, chatId: number, userId: number) =>
    call<{ ok: boolean; result?: { status: string } }>(env, "getChatMember", { chat_id: chatId, user_id: userId }),

  setWebhook: (env: Env, url: string) =>
    call(env, "setWebhook", { url, secret_token: env.WEBHOOK_SECRET, allowed_updates: ["message", "chat_join_request", "callback_query"] }),
};
