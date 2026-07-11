import { NextResponse } from "next/server";
import { runTick } from "@/lib/telegram/server";

// GET /api/telegram/tick — ONE broadcast cycle. Fired by the Vercel cron (and/or an external
// 1-minute pinger). Protected by CRON_SECRET: Vercel cron sends it as a bearer token automatically,
// external pingers can pass ?secret=.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") || "";
    const q = new URL(req.url).searchParams.get("secret");
    if (auth !== `Bearer ${secret}` && q !== secret) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }
  }
  const result = await runTick();
  return NextResponse.json(result);
}
