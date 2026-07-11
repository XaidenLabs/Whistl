// TxAgent Live — Telegram bot. Broadcasts live goals, corners, and scorelines from TxLINE.
// Run: node bots/trader.mjs   (after filling bots/.env)
import { run, loadEnv } from "./core.mjs";

loadEnv();

run({
  name: "trader",
  label: "TxAgent Live",
  emoji: "📈",
  botToken: process.env.TRADER_BOT_TOKEN,
  apiToken: process.env.TXLINE_API_TOKEN,
  channelId: process.env.TRADER_CHAT_ID || undefined,
  welcome:
    "📈 <b>TxAgent Live</b>\nEvery goal, corner, and scoreline from the World Cup, live from TxLINE.\n\nORA, our AI agent, prices these markets and trades them on-chain by itself. Send /stop to unsubscribe.",
  footer: () => "📈 ORA is watching this market",
}).catch((e) => { console.error(e.message); process.exit(1); });
