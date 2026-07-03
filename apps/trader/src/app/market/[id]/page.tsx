"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft, TrendingUp, TrendingDown, Sparkles, Loader2 } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import MatchChart, { type Candle } from "@/components/MatchChart";
import BetModal from "@/components/BetModal";
import { parseCurrentScore, type TxScoreEvent } from "@/lib/txline/types";

function cn(...i: ClassValue[]) {
  return twMerge(clsx(i));
}
const fetcher = (url: string) => fetch(url).then((r) => r.json());
type Sel = "home" | "draw" | "away";

type ChartResp = {
  ok: boolean;
  candles: Candle[];
  p1: string;
  p2: string;
  competition: string;
  current: { prob: number; dec: number } | null;
  changePct: number | null;
};

export default function MarketPage() {
  const { id } = useParams<{ id: string }>();
  const fixtureId = Number(id);
  const [sel, setSel] = useState<Sel>("home");
  const [betOpen, setBetOpen] = useState(false);

  const { data: chart, isLoading } = useSWR<ChartResp>(
    Number.isFinite(fixtureId) ? `/api/agent/chart?fixtureId=${fixtureId}&sel=${sel}` : null,
    fetcher, { revalidateOnFocus: false },
  );
  const { data: oddsData } = useSWR<{ ok: boolean; odds?: Record<Sel, { dec: number; pct: number | null }> }>(
    Number.isFinite(fixtureId) ? `/api/txline/odds?fixtureId=${fixtureId}` : null, fetcher,
  );
  const { data: scoreData } = useSWR<{ ok: boolean; scores: TxScoreEvent[] }>(
    Number.isFinite(fixtureId) ? `/api/txline/scores/${fixtureId}` : null, fetcher, { refreshInterval: 30_000 },
  );

  const p1 = chart?.p1 ?? "Home";
  const p2 = chart?.p2 ?? "Away";
  const odds = oddsData?.odds;
  const score = scoreData?.scores ? parseCurrentScore(scoreData.scores) : null;
  const change = chart?.changePct ?? null;
  const up = (change ?? 0) >= 0;

  const legs: { sel: Sel; label: string }[] = [
    { sel: "home", label: p1 },
    { sel: "draw", label: "Draw" },
    { sel: "away", label: p2 },
  ];

  const oraRead = (() => {
    if (change == null) return "ORA is watching the market open up…";
    const who = sel === "draw" ? "the draw" : sel === "home" ? p1 : p2;
    if (Math.abs(change) < 1.5) return `${who}'s price is holding steady — the market hasn't picked a side yet.`;
    return up
      ? `Money is flowing into ${who} — its win-chance has climbed ${Math.abs(change)}% this window. Momentum is building.`
      : `${who} is drifting — its win-chance has slid ${Math.abs(change)}% this window. The market is cooling on them.`;
  })();

  return (
    <div className="min-h-screen bg-[#050505] px-4 py-5 font-mono text-gray-300">
      <div className="mx-auto w-full max-w-3xl">
        <Link href="/" className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-white">
          <ArrowLeft className="size-4" /> Markets
        </Link>

        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-600">{chart?.competition ?? "World Cup"}</p>
            <h1 className="text-xl font-bold text-white">{p1} <span className="text-gray-600">v</span> {p2}</h1>
          </div>
          {score && (
            <div className="text-right">
              <p className="font-mono text-2xl font-bold text-white">{score.p1Goals}–{score.p2Goals}</p>
              <p className="text-[10px] text-emerald-400">
                {score.isFinished ? "FULL TIME" : score.clockRunning ? `${score.minutes}' LIVE` : "—"}
              </p>
            </div>
          )}
        </div>

        {/* Outcome tabs = the tradeable "assets" */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {legs.map((l) => {
            const leg = odds?.[l.sel];
            const active = sel === l.sel;
            return (
              <button key={l.sel} onClick={() => setSel(l.sel)}
                className={cn("rounded-lg border p-3 text-left transition-colors",
                  active ? "border-emerald-500 bg-emerald-500/10" : "border-white/10 bg-[#0a0a0a] hover:border-white/20")}>
                <p className="truncate text-[10px] text-gray-400">{l.sel === "draw" ? "Draw" : l.label}</p>
                <p className="text-lg font-bold text-white">{leg?.pct != null ? `${Math.round(leg.pct)}%` : "—"}</p>
                <p className="text-[10px] text-gray-500">{leg?.dec ? `${leg.dec.toFixed(2)}×` : ""}</p>
              </button>
            );
          })}
        </div>

        {/* Price + candlestick chart */}
        <div className="mt-3 rounded-xl border border-white/10 bg-[#0a0a0a] p-3">
          <div className="mb-2 flex items-baseline justify-between px-1">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-600">
                {sel === "draw" ? "Draw" : sel === "home" ? p1 : p2} · win-probability
              </p>
              <p className="text-2xl font-bold text-white">
                {chart?.current ? `${chart.current.prob}%` : "—"}
                {change != null && (
                  <span className={cn("ml-2 inline-flex items-center gap-1 text-sm font-bold", up ? "text-emerald-400" : "text-red-400")}>
                    {up ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                    {up ? "+" : ""}{change}%
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="h-72 w-full">
            {isLoading && !chart ? (
              <div className="flex h-full items-center justify-center text-gray-600"><Loader2 className="size-5 animate-spin" /></div>
            ) : chart && chart.candles.length > 1 ? (
              <MatchChart candles={chart.candles} />
            ) : (
              <div className="flex h-full items-center justify-center text-center text-xs text-gray-600">
                Not enough price history for this market yet.
              </div>
            )}
          </div>
        </div>

        {/* ORA reads the market */}
        <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] p-4">
          <p className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-emerald-400">
            <Sparkles className="size-3" /> ORA reads the market
          </p>
          <p className="text-sm leading-relaxed text-gray-300">{oraRead}</p>
        </div>

        {/* Predict / trade */}
        <button onClick={() => setBetOpen(true)}
          className="mt-3 w-full rounded-lg bg-emerald-500 py-3 text-sm font-bold text-black hover:bg-emerald-400">
          Predict the outcome — place a trade
        </button>
        <p className="mt-2 text-center text-[10px] text-gray-600">
          Back who you think wins with your paper wallet · settles automatically on the real result.
        </p>
      </div>

      {betOpen && (
        <BetModal fixture={{ FixtureId: fixtureId, Participant1: p1, Participant2: p2 }} onClose={() => setBetOpen(false)} />
      )}
    </div>
  );
}
