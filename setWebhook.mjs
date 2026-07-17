// Usage:
//   TELEGRAM_BOT_TOKEN=xxxx WEBHOOK_SECRET=yyyy WORKER_URL=https://your-worker.workers.dev node scripts/setWebhook.mjs
//
// Run this once after `wrangler deploy` (and again any time your Worker URL changes).

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.WEBHOOK_SECRET;
const workerUrl = process.env.WORKER_URL;

if (!token || !secret || !workerUrl) {
  console.error("Missing env vars. Required: TELEGRAM_BOT_TOKEN, WEBHOOK_SECRET, WORKER_URL");
  process.exit(1);
}

const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    url: workerUrl,
    secret_token: secret,
    allowed_updates: ["message", "chat_join_request", "callback_query"],
  }),
});

const data = await res.json();
console.log(JSON.stringify(data, null, 2));
