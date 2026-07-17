import type { Env, TgMessage, GroupSettings } from "./types";
import { tg } from "./telegram";
import { isOnProbation } from "./storage";

// Extend this list with any domains/keywords you keep seeing in your groups.
const ADULT_KEYWORDS = [
  "xxx", "porn", "onlyfans", "18+", "nsfw", "sex chat", "hot girls", "camgirl",
];

const LINK_PATTERN = /(https?:\/\/|t\.me\/|www\.)\S+/i;

export async function moderateMessage(env: Env, msg: TgMessage, settings: GroupSettings): Promise<boolean> {
  if (!msg.text || !msg.from) return false;
  if (msg.from.is_bot) return false;

  const text = msg.text.toLowerCase();
  const hasLink = LINK_PATTERN.test(text) || (msg.entities ?? []).some((e) => e.type === "url" || e.type === "text_link");
  const hasAdultKeyword = settings.adultKeywordFilterEnabled && ADULT_KEYWORDS.some((kw) => text.includes(kw));

  if (!hasLink && !hasAdultKeyword) return false;

  // Adult keywords are always removed regardless of membership age.
  if (hasAdultKeyword) {
    await tg.deleteMessage(env, msg.chat.id, msg.message_id);
    await tg.banChatMember(env, msg.chat.id, msg.from.id);
    return true;
  }

  // Links are only restricted during the new-member probation window.
  if (hasLink && settings.linkFilterEnabled) {
    const onProbation = await isOnProbation(env, msg.chat.id, msg.from.id, settings.probationMinutes);
    if (onProbation) {
      await tg.deleteMessage(env, msg.chat.id, msg.message_id);
      await tg.sendMessage(
        env,
        msg.chat.id,
        `⚠️ <a href="tg://user?id=${msg.from.id}">${escapeHtml(msg.from.first_name)}</a>, new members can't post links for ${settings.probationMinutes} minutes after joining. Message removed.`
      );
      return true;
    }
  }

  return false;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
