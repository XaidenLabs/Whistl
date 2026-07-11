# Live Telegram bots (WHISTL · PULSE · TxAgent)

Three Telegram bots, one per platform, that broadcast **live goals, corners, and scorelines** for
every World Cup match, straight from the **TxLINE** feed. Each bot has its own branding and its own
BotFather token, but they share one data core (`core.mjs`).

No dependencies. Node 18+ only (uses global `fetch`).

## What they broadcast
- ⚽ **Goals** with the running scoreline and match minute
- 🚩 **Corners** as they change, with the current score
- 🏁 **Full time** with the final score and total corners

On start each bot silently snapshots in-progress matches, then only broadcasts *changes*, so it never
spams the whole feed on boot.

## Setup (5 minutes)
1. In Telegram, open **@BotFather**, send `/newbot` three times, and create:
   - a WHISTL bot, a PULSE bot, and a TxAgent bot.
   BotFather gives you a token for each (looks like `12345:AA...`).
2. Copy the config and fill it in:
   ```bash
   cp bots/.env.example bots/.env
   ```
   - Put each token in `WHISTL_BOT_TOKEN`, `PULSE_BOT_TOKEN`, `TRADER_BOT_TOKEN`.
   - Put your TxLINE token in `TXLINE_API_TOKEN` (copy it from `derisk/.env`).
   - `*_CHAT_ID` is optional: set it to a channel/group id to broadcast there too (add the bot as
     admin). Leave blank to broadcast only to people who DM the bot `/start`.

## Run
Each bot is a long-running process. Start them in separate terminals:
```bash
node bots/whistl.mjs
node bots/pulse.mjs
node bots/trader.mjs
```
Then open each bot in Telegram and send **/start** to subscribe. Send **/stop** to unsubscribe.

## For the demo
- Start the bot for the track you are filming, DM it `/start`, and show a goal or corner alert
  arriving live on your phone while the match plays. This is the "AI Pundit Bot" idea from the
  Consumer track, powered end to end by TxLINE.
- If no match is live during recording, point the bot at a channel and pre-seed a couple of alerts,
  or narrate the message format from a past match.

## Notes
- Subscribers are stored per bot in `bots/.subs-<name>.json` (git-ignored).
- Poll interval is 40s by default (`pollMs` in each launcher). TxLINE has no rate limit on the free
  World Cup tier, but keep it reasonable.
- To keep a bot running 24/7, deploy it on any small always-on host (Railway, Fly.io, a VPS, or
  `pm2`), with the same `bots/.env`.
