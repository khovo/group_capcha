import type { Env, TgMessage } from "./types";
import { tg } from "./telegram";
import { getSettings, saveSettings } from "./storage";

async function isAdmin(env: Env, chatId: number, userId: number): Promise<boolean> {
  const res = await tg.getChatMember(env, chatId, userId);
  const status = res.result?.status;
  return status === "administrator" || status === "creator";
}

export async function handleCommand(env: Env, msg: TgMessage): Promise<void> {
  if (!msg.text || !msg.from) return;
  const chatId = msg.chat.id;
  const [cmdRaw, ...args] = msg.text.trim().split(/\s+/);
  const cmd = cmdRaw.replace(/@\w+$/, "").toLowerCase(); // strip @BotName suffix

  if (msg.chat.type === "private") {
    if (cmd === "/start" || cmd === "/help") {
      await tg.sendMessage(
        env,
        chatId,
        "👋 I'm a Group Guard bot.\n\n" +
          "Add me as <b>admin</b> to a group (with the 'Add Members' / 'Invite via link' permission so I can approve join requests), " +
          "turn on <i>Approve new members</i> in group settings, and I'll captcha-verify every join request and filter spam links / adult content automatically.\n\n" +
          "Group admin commands (run inside the group):\n" +
          "/settings — show current settings\n" +
          "/captcha on|off\n" +
          "/linkfilter on|off\n" +
          "/adultfilter on|off\n" +
          "/timeout &lt;seconds&gt;\n" +
          "/probation &lt;minutes&gt;\n" +
          "/welcome &lt;message, use {name}&gt;"
      );
    }
    return;
  }

  // Group-only admin commands below.
  const adminCommands = ["/settings", "/captcha", "/linkfilter", "/adultfilter", "/timeout", "/probation", "/welcome"];
  if (!adminCommands.includes(cmd)) return;

  if (!(await isAdmin(env, chatId, msg.from.id))) {
    await tg.sendMessage(env, chatId, "🚫 Only group admins can change my settings.");
    return;
  }

  const settings = await getSettings(env, chatId);

  switch (cmd) {
    case "/settings": {
      await tg.sendMessage(
        env,
        chatId,
        `⚙️ <b>Current settings</b>\n` +
          `Captcha: ${settings.captchaEnabled ? "ON" : "OFF"}\n` +
          `Captcha timeout: ${settings.timeoutSeconds}s\n` +
          `Link filter: ${settings.linkFilterEnabled ? "ON" : "OFF"}\n` +
          `Probation window: ${settings.probationMinutes} min\n` +
          `Adult-content filter: ${settings.adultKeywordFilterEnabled ? "ON" : "OFF"}\n` +
          `Welcome message: ${settings.welcomeMessage}`
      );
      break;
    }
    case "/captcha": {
      settings.captchaEnabled = args[0]?.toLowerCase() === "on";
      await saveSettings(env, chatId, settings);
      await tg.sendMessage(env, chatId, `✅ Captcha ${settings.captchaEnabled ? "enabled" : "disabled"}.`);
      break;
    }
    case "/linkfilter": {
      settings.linkFilterEnabled = args[0]?.toLowerCase() === "on";
      await saveSettings(env, chatId, settings);
      await tg.sendMessage(env, chatId, `✅ Link filter ${settings.linkFilterEnabled ? "enabled" : "disabled"}.`);
      break;
    }
    case "/adultfilter": {
      settings.adultKeywordFilterEnabled = args[0]?.toLowerCase() === "on";
      await saveSettings(env, chatId, settings);
      await tg.sendMessage(env, chatId, `✅ Adult-content filter ${settings.adultKeywordFilterEnabled ? "enabled" : "disabled"}.`);
      break;
    }
    case "/timeout": {
      const secs = parseInt(args[0], 10);
      if (!secs || secs < 30 || secs > 3600) {
        await tg.sendMessage(env, chatId, "Usage: /timeout <seconds between 30 and 3600>");
        break;
      }
      settings.timeoutSeconds = secs;
      await saveSettings(env, chatId, settings);
      await tg.sendMessage(env, chatId, `✅ Captcha timeout set to ${secs}s.`);
      break;
    }
    case "/probation": {
      const mins = parseInt(args[0], 10);
      if (!mins || mins < 1 || mins > 1440) {
        await tg.sendMessage(env, chatId, "Usage: /probation <minutes between 1 and 1440>");
        break;
      }
      settings.probationMinutes = mins;
      await saveSettings(env, chatId, settings);
      await tg.sendMessage(env, chatId, `✅ New-member probation window set to ${mins} minutes.`);
      break;
    }
    case "/welcome": {
      const text = msg.text.slice(cmdRaw.length).trim();
      if (!text) {
        await tg.sendMessage(env, chatId, "Usage: /welcome <message>. Use {name} to insert the member's name.");
        break;
      }
      settings.welcomeMessage = text;
      await saveSettings(env, chatId, settings);
      await tg.sendMessage(env, chatId, "✅ Welcome message updated.");
      break;
    }
  }
}
