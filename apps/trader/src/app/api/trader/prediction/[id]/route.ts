import { NextResponse } from "next/server";
import { getBet, markSettled, evaluateBet } from "@/lib/trader/betstore";
import { getScoresSnapshot, getOddsSnapshot } from "@/lib/txline/server";
import { parseCurrentScore, parse1X2, parseOU, type TxScoreEvent, type TxOddsEntry } from "@/lib/txline/types";

// GET /api/trader/prediction/[id] — PUBLIC, shareable. Returns a placed prediction plus the live
// match state (score + current win-probability of the picked side). If the match has finished and
// the bet is still open, it settles it against the real TxLINE result on read. No auth: anyone with
// the link can watch it settle "by proof, not an admin".

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const bet = await getBet(id);
  if (!bet) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  let score: ReturnType<typeof parseCurrentScore> = null;
  let currentProb: number | null = null;
  let currentDec: number | null = null;
  try {
    score = parseCurrentScore((await getScoresSnapshot(bet.fixture_id)) as TxScoreEvent[]);
  } catch { /* score feed not ready */ }
  try {
    const raw = (await getOddsSnapshot(bet.fixture_id)) as TxOddsEntry[];
    if (bet.market === "goals_ou") {
      const ou = parseOU(raw);
      const leg = ou ? (bet.selection === "over" ? ou.over : ou.under) : null;
      currentProb = leg?.pct ?? null;
      currentDec = leg?.dec ?? null;
    } else {
      const x = parse1X2(raw);
      if (x) {
        const leg = bet.selection === "home" ? x.home : bet.selection === "away" ? x.away : x.draw;
        currentProb = leg.pct;
        currentDec = leg.dec;
      }
    }
  } catch { /* odds not available */ }

  // Settle on read if the match is over and the bet is still open.
  let settled = bet;
  if (bet.status === "open" && score?.isFinished) {
    const won = evaluateBet(bet, score.p1Goals, score.p2Goals) === "won";
    const pnl = Math.round((won ? bet.stake * (bet.odds - 1) : -bet.stake) * 100) / 100;
    await markSettled(bet.id, won ? "won" : "lost", pnl);
    settled = { ...bet, status: won ? "won" : "lost", pnl };
  }

  return NextResponse.json({
    ok: true,
    bet: settled,
    live: {
      finalScore: score ? `${score.p1Goals}-${score.p2Goals}` : null,
      minutes: score?.minutes ?? null,
      clockRunning: score?.clockRunning ?? false,
      isFinished: score?.isFinished ?? false,
      currentProb,
      currentDec,
    },
  });
}
