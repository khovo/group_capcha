// Minimal Telegram type defs -- only the fields this bot actually reads/writes.

export interface Env {
  BOT_KV: KVNamespace;
  TELEGRAM_BOT_TOKEN: string;
  WEBHOOK_SECRET: string;
  BOT_OWNER_ID?: string;
}

export interface TgUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
}

export interface TgChat {
  id: number;
  title?: string;
  type: "private" | "group" | "supergroup" | "channel";
}

export interface TgMessage {
  message_id: number;
  from?: TgUser;
  chat: TgChat;
  date: number;
  text?: string;
  entities?: Array<{ type: string; offset: number; length: number }>;
}

export interface TgChatJoinRequest {
  chat: TgChat;
  from: TgUser;
  date: number;
  bio?: string;
  invite_link?: { invite_link: string; name?: string };
}

export interface TgCallbackQuery {
  id: string;
  from: TgUser;
  message?: TgMessage;
  data?: string;
}

export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  chat_join_request?: TgChatJoinRequest;
  callback_query?: TgCallbackQuery;
}

export interface GroupSettings {
  captchaEnabled: boolean;
  timeoutSeconds: number; // how long a user has to solve the captcha
  welcomeMessage: string;
  linkFilterEnabled: boolean; // delete links from very-new members
  probationMinutes: number; // "new member" window for the link filter
  adultKeywordFilterEnabled: boolean;
}

export const DEFAULT_SETTINGS: GroupSettings = {
  captchaEnabled: true,
  timeoutSeconds: 180,
  welcomeMessage: "Welcome, {name}! You have been verified. 🎉",
  linkFilterEnabled: true,
  probationMinutes: 30,
  adultKeywordFilterEnabled: true,
};

export interface PendingCaptcha {
  chatId: number;
  userId: number;
  chatTitle: string;
  correctAnswer: number;
  createdAt: number;
  expiresAt: number;
}
