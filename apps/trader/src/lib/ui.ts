import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind-aware className combiner (shared across trader components). */
export function cn(...i: ClassValue[]) {
  return twMerge(clsx(i));
}

/** Standard SWR JSON fetcher. */
export const fetcher = (url: string) => fetch(url).then((r) => r.json());

/** "Today 18:00" / "Tomorrow 21:00" / "12 Jul 18:00" for upcoming kickoffs. */
export function kickoff(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (d.toDateString() === now.toDateString()) return `Today ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow ${time}`;
  return `${d.toLocaleDateString([], { day: "numeric", month: "short" })} ${time}`;
}
