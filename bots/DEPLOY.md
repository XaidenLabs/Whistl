# Telegram bots — automatic on Vercel (no process to start)

Each app (WHISTL, PULSE, TxAgent) ships its own Telegram bot as **serverless routes**, so once the
apps are deployed the bots run themselves. No `node bots/*.mjs` needed. (The scripts in this folder
still work for running a bot locally; this file is the always-on Vercel path.)

**How it works:** a cron/pinger hits `GET /api/telegram/tick` on a schedule. That route runs ONE
poll of the TxLINE live scores, compares against the last state (saved in Supabase), and broadcasts
any goals, corners, or full-time results to everyone who subscribed. Subscriptions come in through a
Telegram webhook at `POST /api/telegram/webhook`.

## One-time setup

### 1. Make three bots
In Telegram, open **@BotFather**, run `/newbot` three times (a WHISTL bot, a PULSE bot, a TxAgent
bot). Copy each token.

### 2. Create the database tables
Run `bots/telegram-supabase.sql` once in the Supabase SQL editor (same project all three apps use).

### 3. Set env vars in each Vercel project
Each app already has these in its local `.env.local`; set the same in Vercel
(Settings -> Environment Variables), one bot token per project:
- `TELEGRAM_BOT_TOKEN` the BotFather token for THAT app's bot
- `TELEGRAM_BOT_NAME` `whistl` / `pulse` / `trader` (already set, do not change)
- `TELEGRAM_BOT_LABEL`, `TELEGRAM_BOT_FOOTER` branding (already set)
- `TELEGRAM_CHAT_ID` optional: a channel/group id to also post to (add the bot as admin)
- `CRON_SECRET` the shared secret (already set, identical in all three)
- Supabase vars must be present (they already are).

### 4. Deploy, then register each webhook (once)
After deploying, open this URL once per app (in a browser):
```
https://YOUR-APP.vercel.app/api/telegram/setup?secret=YOUR_CRON_SECRET
```
It points Telegram at that app's webhook and sets the /start and /stop menu. You should see
`{ "ok": true, ... }`.

### 5. Turn on the live pinger
Vercel Hobby crons only run once a day, so drive the ticks from outside:
- **Easiest (in this repo):** the GitHub Action at `.github/workflows/telegram-bots.yml` runs every
  5 minutes. Add repo secrets `WHISTL_URL`, `PULSE_URL`, `TRADER_URL` (your Vercel URLs) and
  `CRON_SECRET`. Done.
- **For instant (1-minute) alerts:** create three cron jobs on [cron-job.org](https://cron-job.org)
  (free), each hitting `https://YOUR-APP.vercel.app/api/telegram/tick?secret=YOUR_CRON_SECRET` every
  minute. Or upgrade Vercel to Pro and change the cron in each `vercel.json` to `* * * * *`.

## Use it
Open each bot in Telegram and send **/start**. You will get live goals, corners, and scorelines for
every World Cup match. Send **/stop** to unsubscribe.

## Test a single cycle by hand
```
curl "https://YOUR-APP.vercel.app/api/telegram/tick?secret=YOUR_CRON_SECRET"
```
Returns e.g. `{ "ok": true, "bot": "whistl", "subscribers": 3, "live": 2, "checked": 2, "changes": 1 }`.
On the first run for a match it records the score silently, then only broadcasts changes after that.
