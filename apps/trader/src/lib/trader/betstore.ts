import "server-only";
import { randomUUID } from "crypto";
import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase/server";

// Per-user paper-trading wallet. Everyone starts with 1000 paper USDC. Placing a bet locks the
// stake; when the match settles against the real TxLINE result, a winning bet is paid out
// (stake × odds). Persisted in Supabase (`trader_bets`), with an in-memory fallback for demos.

export const STARTING_BALANCE = 1000;

export type Market = "1x2" | "goals_ou";
export type Selection = "home" | "draw" | "away" | "over" | "under";
export type BetStatus = "open" | "won" | "lost";

export type Bet = {
  id: string;
  user_did: string;
  fixture_id: number;
  match: string;
  market: Market;         // "1x2" = match winner, "goals_ou" = total goals over/under `line`
  line: number | null;    // only for goals_ou (e.g. 2.5)
  selection: Selection;
  odds: number;
  stake: number;
  status: BetStatus;
  pnl: number | null;
  created_at: string;
};

/** Decide a settled bet's outcome from the real final score. Handles 1X2 and goals O/U. */
export function evaluateBet(bet: Pick<Bet, "market" | "line" | "selection">, p1Goals: number, p2Goals: number): "won" | "lost" {
  if (bet.market === "goals_ou" && bet.line != null) {
    const over = p1Goals + p2Goals > bet.line;
    return (bet.selection === "over" ? over : !over) ? "won" : "lost";
  }
  const result = p1Goals > p2Goals ? "home" : p2Goals > p1Goals ? "away" : "draw";
  return result === bet.selection ? "won" : "lost";
}

let backend: "supabase" | "memory" | null = null;
async function resolveBackend(): Promise<"supabase" | "memory"> {
  if (backend) return backend;
  if (!supabaseConfigured()) return (backend = "memory");
  const { error } = await supabaseAdmin().from("trader_bets").select("id").limit(1);
  backend = error ? "memory" : "supabase";
  if (error) console.warn("[trader] trader_bets table missing · using in-memory store. Run supabase/trader.sql to persist.");
  return backend;
}

const mem: Bet[] = [];

export async function getUserBets(userDid: string): Promise<Bet[]> {
  if ((await resolveBackend()) === "supabase") {
    const { data } = await supabaseAdmin()
      .from("trader_bets")
      .select("*")
      .eq("user_did", userDid)
      .order("created_at", { ascending: false });
    return (data as Bet[]) ?? [];
  }
  return mem.filter((b) => b.user_did === userDid).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Fetch a single bet by id (any user) — powers the public, shareable prediction page. */
export async function getBet(id: string): Promise<Bet | null> {
  if ((await resolveBackend()) === "supabase") {
    const { data } = await supabaseAdmin().from("trader_bets").select("*").eq("id", id).maybeSingle();
    return (data as Bet) ?? null;
  }
  return mem.find((b) => b.id === id) ?? null;
}

/** Balance = 1000 − every stake placed + every winning payout (stake × odds). */
export function balanceOf(bets: Bet[]): number {
  let bal = STARTING_BALANCE;
  for (const b of bets) {
    bal -= b.stake;
    if (b.status === "won") bal += b.stake * b.odds;
  }
  return Math.round(bal * 100) / 100;
}

export async function placeBet(
  userDid: string,
  input: { fixtureId: number; match: string; selection: Selection; odds: number; stake: number; market?: Market; line?: number | null },
): Promise<{ ok: true; bet: Bet } | { ok: false; error: string }> {
  const { fixtureId, match, selection, odds, stake } = input;
  const market: Market = input.market ?? "1x2";
  const line = market === "goals_ou" ? (input.line ?? null) : null;
  if (!(stake > 0)) return { ok: false, error: "Stake must be positive" };
  if (!(odds > 1)) return { ok: false, error: "Invalid odds" };
  if (market === "goals_ou" && line == null) return { ok: false, error: "Missing goals line" };

  const bets = await getUserBets(userDid);
  const bal = balanceOf(bets);
  if (stake > bal) return { ok: false, error: `Not enough balance · you have ${bal} USDC` };

  const bet: Bet = {
    id: randomUUID(),
    user_did: userDid,
    fixture_id: fixtureId,
    match,
    market,
    line,
    selection,
    odds: Math.round(odds * 1000) / 1000,
    stake: Math.round(stake * 100) / 100,
    status: "open",
    pnl: null,
    created_at: new Date().toISOString(),
  };

  if ((await resolveBackend()) === "supabase") {
    const { error } = await supabaseAdmin().from("trader_bets").insert({
      id: bet.id, user_did: userDid, fixture_id: fixtureId, match, market, line, selection, odds: bet.odds, stake: bet.stake, status: "open",
    });
    if (error) {
      // Migration not applied yet (no market/line columns). 1X2 still works without them;
      // goals bets require the migration.
      const missingCols = /column .*(market|line)/i.test(error.message);
      if (missingCols && market === "1x2") {
        const retry = await supabaseAdmin().from("trader_bets").insert({
          id: bet.id, user_did: userDid, fixture_id: fixtureId, match, selection, odds: bet.odds, stake: bet.stake, status: "open",
        });
        if (retry.error) return { ok: false, error: retry.error.message };
      } else if (missingCols) {
        return { ok: false, error: "Goals betting needs a quick DB migration · run supabase/trader.sql." };
      } else {
        return { ok: false, error: error.message };
      }
    }
  } else {
    mem.push(bet);
  }
  return { ok: true, bet };
}

export async function markSettled(betId: string, status: "won" | "lost", pnl: number): Promise<void> {
  if ((await resolveBackend()) === "supabase") {
    await supabaseAdmin().from("trader_bets").update({ status, pnl }).eq("id", betId);
  } else {
    const b = mem.find((x) => x.id === betId);
    if (b) { b.status = status; b.pnl = pnl; }
  }
}
