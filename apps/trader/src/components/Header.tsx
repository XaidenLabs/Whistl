"use client";

import Link from "next/link";
import { Zap } from "lucide-react";
import UserBar from "@/components/UserBar";

/** Shared top bar. `tagline` is an optional per-page subtitle next to the wordmark. */
export default function Header({ tagline }: { tagline?: string }) {
  return (
    <header className="flex items-center justify-between border-b border-white/10 bg-black px-4 py-3 sm:px-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-emerald-500/20 text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
            <Zap className="size-4" />
          </div>
          <h1 className="text-sm font-bold tracking-widest text-white">
            TxAGENT <span className="text-gray-600">|</span> DESK
          </h1>
        </Link>
        {tagline && (
          <span className="hidden rounded bg-white/5 px-2 py-0.5 text-[10px] text-gray-500 sm:inline">{tagline}</span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <nav className="hidden items-center gap-4 text-xs text-gray-400 md:flex">
          <Link href="/markets" className="hover:text-white">Markets</Link>
          <Link href="/ora" className="hover:text-white">ORA</Link>
          <Link href="/portfolio" className="hover:text-white">Portfolio</Link>
        </nav>
        <span className="hidden items-center gap-2 text-xs text-emerald-400 lg:flex">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          TXLINE CONNECTED
        </span>
        <UserBar />
      </div>
    </header>
  );
}
