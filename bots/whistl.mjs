// WHISTL Live — Telegram bot. Broadcasts live goals, corners, and scorelines from TxLINE.
// Run: node bots/whistl.mjs   (after filling bots/.env)
import { run, loadEnv } from "./core.mjs";

loadEnv();

run({
  name: "whistl",
  label: "WHISTL Live",
  emoji: "⚖️",
  botToken: process.env.WHISTL_BOT_TOKEN,
  apiToken: process.env.TXLINE_API_TOKEN,
  channelId: process.env.WHISTL_CHAT_ID || undefined,
  welcome:
    "⚖️ <b>WHISTL Live</b>\nYou'll get every goal, corner, and scoreline from the World Cup, live from TxLINE.\n\nOn WHISTL, bets on these matches settle themselves on-chain, no admin decides. Send /stop to unsubscribe.",
  footer: () => "⚖️ Settles on-chain via TxLINE proof",
}).catch((e) => { console.error(e.message); process.exit(1); });
