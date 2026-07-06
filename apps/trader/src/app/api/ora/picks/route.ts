import { NextResponse } from "next/server";
import { getFixtures, getOddsSnapshot, TxlineTokenMissing } from "@/lib/txline/server";
import { parse1X2, type TxFixture, type TxOddsEntry } from "@/lib/txline/types";
import { oraPick } from "@/lib/ora/pick";

// GET /api/ora/picks — the home feed. Live/upcoming matches, each with ORA's recommended pick
// derived from real live TxLINE odds. One request → the whole "tap to back" feed.

const MAX = 10;

export async function GET() {
  try {
    const fixtures = (await getFixtures({ startEpochDay: Math.floor(Date.now() / 86_400_000) - 1 })) as TxFixture[];
    const now = Date.now();
    const LIVE_MS = 2.5 * 3600e3;

    const tradeable = fixtures
      .map((f) => ({ f, phase: (now < f.StartTime ? "upcoming" : now < f.StartTime + LIVE_MS ? "live" : "finished") as "upcoming" | "live" | "finished" }))
      .filter((x) => x.phase !== "finished")
      .sort((a, b) => Number(b.phase === "live") - Number(a.phase === "live") || a.f.StartTime - b.f.StartTime)
      .slice(0, MAX);

    const picks = (await Promise.all(
      tradeable.map(async ({ f, phase }) => {
        try {
          const odds = parse1X2((await getOddsSnapshot(f.FixtureId)) as TxOddsEntry[]);
          const pick = oraPick(odds);
          if (!pick) return null;
          const team = pick.selection === "home" ? f.Participant1 : pick.selection === "away" ? f.Participant2 : "the Draw";
          return {
            fixtureId: f.FixtureId,
            p1: f.Participant1,
            p2: f.Participant2,
            competition: f.Competition,
            startTime: f.StartTime,
            phase,
            pick: { ...pick, team },
          };
        } catch {
          return null;
        }
      }),
    )).filter((x): x is NonNullable<typeof x> => x !== null);

    return NextResponse.json({ ok: true, picks });
  } catch (e) {
    if (e instanceof TxlineTokenMissing) return NextResponse.json({ ok: false, error: "TXLINE_TOKEN_MISSING" }, { status: 503 });
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
