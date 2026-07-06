// ORA's pick for a single match — a pure, client-safe function so both the home feed
// (server) and the match desk (client) compute the same recommendation.
//
// ORA is transparent by design: its call is the outcome its read rates highest right now
// (highest live win-probability from the demargined TxLINE 1X2 market). Honest, simple,
// and it varies by match — favourites, upsets, and the odd draw all surface.

export type Sel = "home" | "draw" | "away";
type Leg = { dec: number; pct: number | null };
export type Odds1X2 = { home: Leg; draw: Leg; away: Leg } | null;

export type OraPick = {
  selection: Sel;
  prob: number; // implied win-% ORA is backing
  dec: number;  // decimal odds
  tier: "banker" | "value" | "edge";
  confidence: string; // short human label
};

/** Compute ORA's recommended pick from a live 1X2 market. Returns null if unpriced. */
export function oraPick(o: Odds1X2): OraPick | null {
  if (!o) return null;
  const legs: { selection: Sel; prob: number; dec: number }[] = [
    { selection: "home", prob: o.home.pct ?? -1, dec: o.home.dec },
    { selection: "draw", prob: o.draw.pct ?? -1, dec: o.draw.dec },
    { selection: "away", prob: o.away.pct ?? -1, dec: o.away.dec },
  ].filter((l) => l.prob >= 0 && l.dec > 1);
  if (!legs.length) return null;

  const best = legs.reduce((a, b) => (b.prob > a.prob ? b : a));
  const prob = Math.round(best.prob);
  const tier: OraPick["tier"] = prob >= 60 ? "banker" : prob >= 45 ? "edge" : "value";
  const confidence =
    tier === "banker" ? "Strong favourite" : tier === "edge" ? "ORA's edge" : "Value call";

  return { selection: best.selection, prob, dec: Math.round(best.dec * 100) / 100, tier, confidence };
}

/** Potential payout on a stake, rounded to cents. */
export function payoutOn(stake: number, dec: number): number {
  return Math.round(stake * dec * 100) / 100;
}

// ─── Goals Over/Under market ────────────────────────────────────────────────
type OuLeg = { dec: number; pct: number | null };
export type OuOdds = { line: string; over: OuLeg; under: OuLeg } | null;
export type OraGoalsPick = {
  selection: "over" | "under";
  line: number;
  prob: number;
  dec: number;
  label: string; // "Over 2.5" / "Under 2.5"
};

/** ORA's total-goals call from the live Over/Under market. */
export function oraGoalsPick(ou: OuOdds): OraGoalsPick | null {
  if (!ou) return null;
  const line = parseFloat(ou.line);
  const o = ou.over, u = ou.under;
  if (o.pct == null || u.pct == null || !(o.dec > 1) || !(u.dec > 1) || !Number.isFinite(line)) return null;
  const pick = o.pct >= u.pct
    ? { selection: "over" as const, prob: o.pct, dec: o.dec }
    : { selection: "under" as const, prob: u.pct, dec: u.dec };
  return {
    selection: pick.selection,
    line,
    prob: Math.round(pick.prob),
    dec: Math.round(pick.dec * 100) / 100,
    label: `${pick.selection === "over" ? "Over" : "Under"} ${line}`,
  };
}
