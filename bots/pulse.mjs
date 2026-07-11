// PULSE Live — Telegram bot. Broadcasts live goals, corners, and scorelines from TxLINE.
// Run: node bots/pulse.mjs   (after filling bots/.env)
import { run, loadEnv } from "./core.mjs";

loadEnv();

run({
  name: "pulse",
  label: "PULSE Live",
  emoji: "📣",
  botToken: process.env.PULSE_BOT_TOKEN,
  apiToken: process.env.TXLINE_API_TOKEN,
  channelId: process.env.PULSE_CHAT_ID || undefined,
  welcome:
    "📣 <b>PULSE Live</b>\nYour World Cup companion. Every goal, corner, and scoreline the second it happens, live from TxLINE.\n\nOpen PULSE to predict matches and read ORA, your AI pundit. Send /stop to unsubscribe.",
  footer: () => "📣 Predict this match live in PULSE",
}).catch((e) => { console.error(e.message); process.exit(1); });
