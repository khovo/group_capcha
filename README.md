# Telegram Group Guard Bot (AI Admin)

Cloudflare Workers ላይ የሚሰራ Telegram bot፣ የ group join requests በ captcha እያረጋገጠ የሚያፀድቅ/የሚክድ፣ እና አዲስ የገቡ አባላት ለተወሰነ ጊዜ ሊንክ እንዳይለጥፉ የሚከለክል፣ የአዋቂ ይዘት (adult content) ቃላት ካሉ መልዕክቱን አጥፍቶ ተጠቃሚውን የሚያግድ ቦት ነው።

## ይህ ቦት የሚሰራው

- **Captcha ለ Join Requests**: Group settings ላይ "Approve new members" ሲበራ፣ አዲስ ሰው Join ሲል ቦቱ በግል መልዕክት (DM) ቀላል ሂሳብ ጥያቄ (ለምሳሌ 3+5=?) ይልካል። በትክክል ከመለሰ በራስ-ሰር ፀድቆ ይገባል፤ ካልመለሰ ወይም ጊዜው ካለቀ በራስ-ሰር ውድቅ ይደረጋል።
- **Link filter**: አዲስ የገባ አባል (probation window - default 30 ደቂቃ) ውስጥ ሊንክ ከለጠፈ መልዕክቱ ወዲያውኑ ይጠፋል።
- **Adult content filter**: የተከለከሉ ቃላት ዝርዝር ውስጥ ያለ ቃል ካገኘ መልዕክቱን አጥፍቶ ተጠቃሚውን ከቡድኑ ያግዳል (ban)።
- **Admin commands** (በቡድን ውስጥ በአድሚን ብቻ ይሰራሉ):
  - `/settings` – የአሁኑን ቅንብሮች ያሳያል
  - `/captcha on|off`
  - `/linkfilter on|off`
  - `/adultfilter on|off`
  - `/timeout <seconds>` – captcha ምላሽ የመስጫ ጊዜ (ነባሪ 180)
  - `/probation <minutes>` – አዲስ አባል ሊንክ የማይለጥፍበት ጊዜ (ነባሪ 30)
  - `/welcome <text>` – {name} የሚለውን ቦታ ስም እየተካ ይልካል

## Architecture

```
Telegram  --webhook-->  Cloudflare Worker (src/index.ts)
                              |
                              v
                     Cloudflare KV (BOT_KV)
        stores: group settings, pending captchas, join timestamps
```

No server to maintain, no polling — Telegram pushes updates straight to your Worker's URL, and Cloudflare Workers run it on-demand for free (generous free tier).

---

## Step 1 — Telegram bot መፍጠር (BotFather)

1. Telegram ላይ **@BotFather** ን ክፈት እና `/newbot` ላክ።
2. ስም እና username ስጠው (username በ `bot` መጨረስ አለበት, ለምሳሌ `MyGroupGuardBot`).
3. BotFather የሚሰጥህን **token** ቅዳ (`123456:ABC-DEF...`)። ይህ secret ነው፣ ለማንም አታሳይ።
4. Privacy mode ማጥፋት ያስፈልጋል ስለ ቦቱ የቡድን መልዕክቶችን ማየት/መሰረዝ ስለሚያስፈልገው:
   - BotFather → `/mybots` → ቦትህን ምረጥ → **Bot Settings** → **Group Privacy** → **Turn off**.

## Step 2 — ቦቱን ወደ Group ጨምር እና Admin አድርገው

1. ቦቱን ወደ group/supergroup ጨምረው።
2. Group → **Manage Group** → **Administrators** → ቦቱን Admin አድርገው በተለይ የሚከተሉትን ፍቃዶች ስጠው፦
   - **Add Members / Invite Users via Link** (ይህ ከሌለ join requests ማፅደቅ አይችልም)
   - **Delete Messages**
   - **Ban Users**
3. Group ውስጥ ገብተህ: **Group Settings → Group Type → Approve New Members** የሚለውን አብራ (ይሄ ካልበራ Telegram `chat_join_request` አይልክም).

## Step 3 — Cloudflare Account እና Wrangler

1. https://dash.cloudflare.com ላይ free account ክፈት (ካልነበረህ)።
2. Node.js (v18+) በኮምፒውተርህ ላይ መኖሩን አረጋግጥ።
3. ይህን ፕሮጀክት አውርደው (ወይም GitHub repo አድርገው clone አድርገው) ፎልደር ውስጥ ግባ፦

```bash
cd telegram-admin-bot
npm install
npx wrangler login
```

`wrangler login` browser ከፍቶ Cloudflare account ካንተ ጋር ያገናኛል።

## Step 4 — KV Namespace ፍጠር

```bash
npx wrangler kv namespace create BOT_KV
```

የሚመልሰውን `id = "...."` ቅዳ እና `wrangler.toml` ውስጥ ባለው `REPLACE_WITH_YOUR_KV_NAMESPACE_ID` ቦታ ላይ ለጥፈው።

## Step 5 — Secrets አስቀምጥ

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
# paste the BotFather token when prompted

npx wrangler secret put WEBHOOK_SECRET
# paste any random long string, e.g. output of: openssl rand -hex 24
```

## Step 6 — Deploy

```bash
npx wrangler deploy
```

Deploy ካለቀ በኋላ የሚያሳይህን URL ቅዳ (ለምሳሌ `https://telegram-group-guard-bot.YOURNAME.workers.dev`)።

## Step 7 — Telegram Webhook አስመዝግብ

```bash
TELEGRAM_BOT_TOKEN=<your token> WEBHOOK_SECRET=<same secret from step 5> WORKER_URL=<your worker url> node scripts/setWebhook.mjs
```

Response ውስጥ `"ok": true` ካየህ ተጠናቀቀ! ቦቱ አሁን live ነው።

## Step 8 (Optional) — GitHub Actions ራስ-ሰር Deploy

Repo ካለህ በእያንዳንዱ push ወደ `main` ራስ-ሰር deploy እንዲደረግ፦

1. GitHub repo → **Settings → Secrets and variables → Actions** ግባ።
2. እነዚህን secrets ጨምር፦
   - `CLOUDFLARE_API_TOKEN` (Cloudflare dashboard → My Profile → API Tokens → "Edit Cloudflare Workers" template)
   - `CLOUDFLARE_ACCOUNT_ID` (Cloudflare dashboard right sidebar ላይ ይታያል)
   - `TELEGRAM_BOT_TOKEN`
   - `WEBHOOK_SECRET`
3. `.github/workflows/deploy.yml` አስቀድሞ repo ውስጥ ተካቷል — push ካደረግክ በኋላ Actions tab ውስጥ ይሮጣል።

---

## Testing

1. Group settings ውስጥ "Approve New Members" አብርተህ ካረጋገጥክ በኋላ፣ ሌላ Telegram account (ወይም ጓደኛህ) በ invite link group ውስጥ join request ይላክ።
2. ቦቱ ለዛ ተጠቃሚ DM ልኮ captcha ማቅረብ አለበት (ተጠቃሚው ቦቱን አስቀድሞ /start ካላደረገው Telegram DM እንዲልክ ላይፈቅድ ስለሚችል፣ group description ላይ "Join before starting @YourBotUsername" ብለህ ማስቀመጥ ይመከራል)።
3. Wrangler logs ለማየት፦ `npx wrangler tail`

## Known limitation to be aware of

Telegram bots ማንኛውንም ተጠቃሚ በ DM ማነጋገር የሚችሉት ተጠቃሚው ቀድሞ ቦቱን "Start" ካደረገው ብቻ ነው (with the join-request exception this bot relies on, which works for most cases but isn't 100% guaranteed by Telegram across all clients). ለተሻለ reliability፣ የ group invite link ፈንታ ተጠቃሚዎችን መጀመሪያ ቦቱን `/start` እንዲያደርጉ ጠይቅ፣ ከዛ group deep link ስጣቸው።

## Extending

- `src/spamFilter.ts` ውስጥ ያለውን `ADULT_KEYWORDS` ዝርዝር በፈለከው ቃላት አክል።
- ተጨማሪ የ captcha ዓይነት (ምስል base captcha) ወይም "I'm not a robot" single-button ብቻ ከፈለክ `src/captcha.ts` ቀይር።
