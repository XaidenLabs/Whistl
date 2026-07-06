import { NextResponse } from "next/server";
import { getScoresSnapshot, getStatValidation, TxlineTokenMissing } from "@/lib/txline/server";
import { parseCurrentScore, type TxScoreEvent } from "@/lib/txline/types";

// GET /api/txline/proof?fixtureId=X&statAKey=1&statBKey=2
// Fetches the Merkle proof bundle for a fixture's final stat. Only meaningful once the match
// is over AND TxLINE has processed the final scores batch into its Merkle tree (a short delay
// after full time), so we guard both cases with clear, non-alarming messages.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const fixtureId = Number(url.searchParams.get("fixtureId"));
  const statAKey = Number(url.searchParams.get("statAKey"));
  const statBKey = url.searchParams.get("statBKey");

  if (!fixtureId || !statAKey) {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }

  try {
    const events = (await getScoresSnapshot(fixtureId)) as TxScoreEvent[];
    const parsed = parseCurrentScore(events);
    const latestSeq = events.reduce((max, e) => Math.max(max, e.Seq), 0);

    if (!parsed || !latestSeq) {
      return NextResponse.json(
        { ok: false, notReady: true, error: "No score data for this match yet." },
        { status: 200 },
      );
    }

    // Don't settle a match that isn't over — the corners/goals aren't final.
    if (!parsed.isFinished) {
      return NextResponse.json(
        { ok: false, matchNotFinished: true, error: "Match still in play · settles automatically after full time." },
        { status: 200 },
      );
    }

    try {
      const proof = await getStatValidation({
        fixtureId,
        seq: latestSeq,
        statKey: statAKey,
        ...(statBKey ? { statKey2: Number(statBKey) } : {}),
      });
      return NextResponse.json({ ok: true, seq: latestSeq, proof });
    } catch (e) {
      const msg = (e as Error).message || "";
      // 404 / "could not be found" = final batch not Merkle-processed yet — expected right after FT.
      if (msg.includes("404") || msg.toLowerCase().includes("could not be found")) {
        return NextResponse.json(
          {
            ok: false,
            notReady: true,
            error: "Full time · TxLINE is finalizing the result on-chain. This takes a few minutes; try settling again shortly.",
          },
          { status: 200 },
        );
      }
      throw e;
    }
  } catch (e) {
    if (e instanceof TxlineTokenMissing) {
      return NextResponse.json({ ok: false, error: "TXLINE_TOKEN_MISSING" }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
