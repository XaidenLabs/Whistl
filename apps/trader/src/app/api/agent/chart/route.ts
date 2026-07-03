import { NextResponse } from "next/server";
import { getFixtures, getOddsSnapshot, TxlineTokenMissing } from "@/lib/txline/server";
import { parse1X2, type TxFixture, type TxOddsEntry } from "@/lib/txline/types";

// GET /api/agent/chart?fixtureId=X&sel=home|draw|away
// The "price" of a match market is the live implied win-probability of an outcome. We sample
// TxLINE odds across the match window (parallel `asOf` snapshots) and turn the series into
// candlesticks — each candle is the move from one sample to the next.

const SAMPLES = 20;
type Sel = "home" | "draw" | "away";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const fixtureId = Number(url.searchParams.get("fixtureId"));
  const sel = (url.searchParams.get("sel") ?? "home") as Sel;
  if (!fixtureId) return NextResponse.json({ ok: false, error: "BAD_FIXTURE_ID" }, { status: 400 });

  try {
    const fixtures = (await getFixtures({ startEpochDay: Math.floor(Date.now() / 86_400_000) - 21 })) as TxFixture[];
    const fx = fixtures.find((f) => f.FixtureId === fixtureId);
    const now = Date.now();
    const start = fx?.StartTime ?? now - 2 * 3600e3;
    // Sample the most recent window of price history up to "now" (or full time for ended games).
    const t1 = Math.min(now, start + 2.5 * 3600e3);
    const t0 = t1 - 4 * 3600e3; // last 4h of odds movement
    const span = Math.max(t1 - t0, 60e3);
    const times = Array.from({ length: SAMPLES }, (_, i) => Math.round(t0 + (span * i) / (SAMPLES - 1)));

    const raw = await Promise.all(
      times.map(async (t) => {
        try {
          const x = parse1X2((await getOddsSnapshot(fixtureId, t)) as TxOddsEntry[]);
          if (!x) return null;
          const leg = sel === "home" ? x.home : sel === "away" ? x.away : x.draw;
          return leg.pct != null && leg.dec ? { t, prob: leg.pct, dec: leg.dec } : null;
        } catch {
          return null;
        }
      }),
    );

    const pts = raw
      .filter((s): s is { t: number; prob: number; dec: number } => s !== null)
      .sort((a, b) => a.t - b.t);

    const candles: { time: number; open: number; high: number; low: number; close: number }[] = [];
    let lastTime = 0;
    for (let i = 1; i < pts.length; i++) {
      const o = Math.round(pts[i - 1].prob * 10) / 10;
      const c = Math.round(pts[i].prob * 10) / 10;
      const time = Math.floor(pts[i].t / 1000);
      if (time <= lastTime) continue; // lightweight-charts requires strictly-increasing unique times
      lastTime = time;
      candles.push({ time, open: o, high: Math.max(o, c), low: Math.min(o, c), close: c });
    }

    const current = pts.at(-1) ?? null;
    const first = pts[0] ?? null;
    return NextResponse.json({
      ok: true,
      candles,
      p1: fx?.Participant1 ?? "Home",
      p2: fx?.Participant2 ?? "Away",
      competition: fx?.Competition ?? "World Cup",
      startTime: start,
      current: current ? { prob: Math.round(current.prob * 10) / 10, dec: current.dec } : null,
      changePct: first && current ? Math.round((current.prob - first.prob) * 10) / 10 : null,
    });
  } catch (e) {
    if (e instanceof TxlineTokenMissing) return NextResponse.json({ ok: false, error: "TXLINE_TOKEN_MISSING" }, { status: 503 });
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
