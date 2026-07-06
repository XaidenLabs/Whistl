import Link from "next/link";
import { getFixtures, getScoresSnapshot } from "@/lib/txline/server";
import { parseCurrentScore, type TxFixture, type TxScoreEvent } from "@/lib/txline/types";

// The hero receipt is driven by the LATEST real TxLINE fixture — no hardcoded match.
// Data updates on the server; the page re-renders live.
export const revalidate = 60;

type Receipt = {
  ref: string;              // e.g. "FX#18188721"
  status: "SETTLED" | "LIVE" | "AWAITING" | "UPCOMING";
  p1: string;
  p2: string;
  statement: string;
  finalLabel: string;       // right-hand value of the "final"/"kickoff" row
  finalRowLabel: string;    // left-hand label ("final" | "live" | "kickoff")
  predicate: "TRUE" | "FALSE" | null;
  winner: "creator" | "counterparty" | null;
};

const abbr = (name: string) => name.slice(0, 3).toUpperCase();

/** Pick the most recent real fixture and build a truthful receipt from live data. */
async function loadReceipt(): Promise<Receipt | null> {
  let fixtures: TxFixture[];
  try {
    fixtures = await getFixtures();
  } catch {
    return null; // TxLINE unavailable · Hero renders a neutral fallback
  }
  if (!fixtures.length) return null;

  const now = Date.now();
  const byRecent = [...fixtures].sort((a, b) => b.StartTime - a.StartTime);
  const kickedOff = byRecent.filter((f) => f.StartTime <= now);

  // Try to attach a real score to the most recent kicked-off matches (cheap: a few calls).
  for (const f of kickedOff.slice(0, 6)) {
    let score: ReturnType<typeof parseCurrentScore> = null;
    try {
      score = parseCurrentScore((await getScoresSnapshot(f.FixtureId)) as TxScoreEvent[]);
    } catch {
      /* scores endpoint not ready — fall through to the no-score receipt */
    }
    if (score) {
      const cornersKnown = score.p1Corners + score.p2Corners > 0;
      const predTrue = cornersKnown
        ? score.p1Corners - score.p2Corners > 3
        : score.p1Goals + score.p2Goals > 2;
      return {
        ref: `FX#${f.FixtureId}`,
        status: score.isFinished ? "SETTLED" : "LIVE",
        p1: f.Participant1,
        p2: f.Participant2,
        statement: cornersKnown
          ? `${f.Participant1} corners − ${f.Participant2} corners > 3`
          : `${f.Participant1} + ${f.Participant2} total goals > 2`,
        finalRowLabel: score.isFinished ? "final" : "live",
        finalLabel: cornersKnown
          ? `${abbr(f.Participant1)} ${score.p1Corners} − ${abbr(f.Participant2)} ${score.p2Corners} cnr`
          : `${abbr(f.Participant1)} ${score.p1Goals} − ${abbr(f.Participant2)} ${score.p2Goals}`,
        predicate: predTrue ? "TRUE" : "FALSE",
        winner: predTrue ? "creator" : "counterparty",
      };
    }
  }

  // No score yet: show the most relevant real fixture, no fabricated result.
  const finished = kickedOff[0];
  const upcoming = byRecent.filter((f) => f.StartTime > now).sort((a, b) => a.StartTime - b.StartTime)[0];
  const f = finished ?? upcoming;
  if (!f) return null;
  const kicked = f.StartTime <= now;
  return {
    ref: `FX#${f.FixtureId}`,
    status: kicked ? "AWAITING" : "UPCOMING",
    p1: f.Participant1,
    p2: f.Participant2,
    statement: `${f.Participant1} corners − ${f.Participant2} corners > 3`,
    finalRowLabel: kicked ? "status" : "kickoff",
    finalLabel: kicked
      ? "full-time · awaiting proof"
      : new Date(f.StartTime).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
    predicate: null,
    winner: null,
  };
}

const STATUS_STYLE: Record<Receipt["status"], { label: string; className: string }> = {
  SETTLED:  { label: "✓ SETTLED", className: "text-signal" },
  LIVE:     { label: "● LIVE", className: "text-live" },
  AWAITING: { label: "◷ FULL-TIME", className: "text-text-dim" },
  UPCOMING: { label: "◷ UPCOMING", className: "text-text-dim" },
};

async function SettlementReceipt() {
  const r = await loadReceipt();

  // Neutral fallback when the live feed is momentarily unavailable — no fake match.
  if (!r) {
    return (
      <div
        className="animate-rise w-full max-w-md rounded-xl border border-line bg-ink-2 font-mono text-xs sm:text-sm"
        style={{ animationDelay: "180ms" }}
      >
        <div className="flex items-center justify-between border-b border-line px-4 sm:px-5 py-3 text-text-dim">
          <span>WHISTL</span>
          <span className="text-text-dim">connecting to TxLINE…</span>
        </div>
        <div className="space-y-3 px-4 sm:px-5 py-4 sm:py-5 text-text-dim">
          <p className="font-sans text-sm sm:text-base text-text">Live World Cup markets load here.</p>
          <p>Every pact settles on a TxLINE Merkle proof · never an admin.</p>
        </div>
        <div className="border-t border-line px-4 sm:px-5 py-3 text-[10px] sm:text-xs text-text-dim">
          settlement via TxLINE <span className="text-proof">validate_stat</span>
        </div>
      </div>
    );
  }

  const status = STATUS_STYLE[r.status];
  return (
    <div
      className="animate-rise w-full max-w-md rounded-xl border border-line bg-ink-2 font-mono text-xs sm:text-sm"
      style={{ animationDelay: "180ms" }}
    >
      <div className="flex items-center justify-between border-b border-line px-4 sm:px-5 py-3 text-text-dim">
        <span>{r.ref}</span>
        <span className={`inline-flex items-center gap-2 ${status.className}`}>{status.label}</span>
      </div>
      <div className="space-y-3 px-4 sm:px-5 py-4 sm:py-5">
        <p className="font-sans text-sm sm:text-base text-text">{r.statement}</p>
        <div className="grid grid-cols-2 gap-y-2 text-text-dim">
          <span>{r.finalRowLabel}</span>
          <span className="text-right text-text">{r.finalLabel}</span>
          {r.predicate && (
            <>
              <span>predicate</span>
              <span className={`text-right ${r.predicate === "TRUE" ? "text-signal" : "text-text"}`}>{r.predicate}</span>
            </>
          )}
          <span>proof</span>
          <span className="text-right text-text">TxLINE Merkle · {r.ref}</span>
          <span>{r.winner ? "payout" : "settles"}</span>
          <span className="text-right text-text">
            {r.winner ? `escrow → ${r.winner}` : "on full-time proof"}
          </span>
        </div>
      </div>
      <div className="border-t border-line px-4 sm:px-5 py-3 text-[10px] sm:text-xs text-text-dim">
        verified on-chain via TxLINE&nbsp;
        <span className="text-proof">validate_stat</span> · no admin signed this
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" aria-hidden />
      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-8 sm:gap-12 px-4 sm:px-6 pb-16 sm:pb-24 pt-8 sm:pt-12 lg:grid-cols-[1.1fr_0.9fr] lg:pt-20">
        <div>
          <p className="animate-rise mb-4 sm:mb-5 inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 font-mono text-[10px] sm:text-xs text-text-dim">
            <span className="size-1.5 rounded-full bg-live animate-livedot" aria-hidden />
            FIFA WORLD CUP 2026 · TRUSTLESS SETTLEMENT
          </p>
          <h1
            className="animate-rise text-balance text-3xl sm:text-5xl lg:text-6xl font-semibold leading-[1.05] tracking-tight"
            style={{ animationDelay: "60ms" }}
          >
            Bet the match.
            <br />
            The <span className="text-signal">whistle</span> settles it.
          </h1>
          <p
            className="animate-rise mt-4 sm:mt-6 max-w-xl text-base sm:text-lg leading-relaxed text-text-dim"
            style={{ animationDelay: "120ms" }}
          >
            Two people wager on a verifiable World Cup stat. Funds lock in a Solana
            escrow. When the match ends, a TxLINE Merkle proof · not an admin ·
            releases the money to the winner.
          </p>
          <div
            className="animate-rise mt-6 sm:mt-8 flex flex-wrap gap-3"
            style={{ animationDelay: "160ms" }}
          >
            <Link
              href="/matches"
              className="rounded-md bg-signal px-5 py-3 font-medium text-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
            >
              Browse live markets
            </Link>
            <Link
              href="#how"
              className="rounded-md border border-line px-5 py-3 font-medium text-text transition-colors hover:bg-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
            >
              How it works
            </Link>
          </div>
        </div>
        <div className="flex justify-center lg:justify-end">
          <SettlementReceipt />
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  {
    n: "01",
    t: "Create a pact",
    d: "Pick a fixture and a verifiable stat · goals, corners, cards, or a margin like \u201ccorners diff > 3\u201d. Stake USDC; it locks in a program escrow.",
  },
  {
    n: "02",
    t: "Someone takes it",
    d: "A counterparty stakes the matching side. Terms are committed on-chain. Now both stakes sit in a PDA neither side controls.",
  },
  {
    n: "03",
    t: "The proof settles it",
    d: "At full time, anyone (or our keeper agent) submits TxLINE\u2019s Merkle proof. The program CPIs validate_stat and pays the winner. No oracle, no admin.",
  },
];

function HowItWorks() {
  return (
    <section id="how" className="border-t border-line bg-ink">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-12 sm:py-20">
        <h2 className="text-sm font-mono uppercase tracking-[0.2em] text-text-dim">
          How settlement works
        </h2>
        <div className="mt-8 sm:mt-10 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="bg-ink-2 p-5 sm:p-7">
              <span className="font-mono text-sm text-signal">{s.n}</span>
              <h3 className="mt-3 sm:mt-4 text-base sm:text-lg font-medium text-text">{s.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-dim">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 sm:px-6 py-6 sm:py-8 text-sm text-text-dim sm:flex-row sm:items-center sm:justify-between">
        <span className="font-mono text-sm font-bold tracking-widest text-text">WHISTL</span>
        <p className="font-mono text-xs">
          No oracle. No admin. The whistle decides.
        </p>
        <p className="text-xs">World Cup 2026 Hackathon · Powered by TxLINE</p>
      </div>
    </footer>
  );
}

export default function Home() {
  return (
    <>
      <main className="flex-1">
        <Hero />
        <HowItWorks />
      </main>
      <Footer />
    </>
  );
}
