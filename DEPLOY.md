# Deploying WHISTL to Vercel

Three **separate** Vercel projects, one GitHub repo (`XaidenLabs/Whistl`). Each app is hosted
on its own domain but they all share the **same backend + smart contract** — because they use
the same environment variables (same ORA wallet, TxLINE token, Supabase, Solana program).

| Project (suggested name) | Root Directory | Framework | Result |
| --- | --- | --- | --- |
| `whistl`  | `apps/whistl` | Next.js | the prop-bet protocol |
| `pulse`   | `apps/pulse`  | Next.js | the fan PWA |
| `txagent` | `apps/trader` | Next.js | the trading desk |

## One-time setup (per project — repeat 3×)

1. **Vercel → Add New → Project → Import** `XaidenLabs/Whistl`.
2. **Root Directory:** click *Edit* and pick the app folder (e.g. `apps/pulse`).
   - Vercel auto-detects the Turborepo/workspace and runs `npm install` at the repo root, which
     links the shared `@whistl/core` package. Leave Build & Install commands on their defaults.
   - Framework Preset should auto-select **Next.js**.
3. **Environment Variables:** open the app's `.env.example` (e.g. `apps/pulse/.env.example`),
   and add each variable with the real value from your local `apps/<app>/.env.local`.
   Apply to **Production** and **Preview**.
   - Variables tagged `[shared]` must be the **same value in all three projects** — that is what
     makes them share one backend and one on-chain program.
   - Leave `NEXT_PUBLIC_BASE_URL` **blank** — the apps auto-use Vercel's `VERCEL_URL` for
     internal API calls.
4. **Deploy.** Repeat for the other two apps.

## Before the apps fully work

- **Supabase (Pulse sweepstake + Whistl pacts):** run the SQL in `apps/pulse/supabase/*.sql`
  (if present) in your Supabase project once, so the tables exist. Without it, sweepstakes fall
  back to in-memory (ephemeral) and pact history won't persist.
- **Privy:** in the Privy dashboard, add each deployed domain (e.g. `pulse.vercel.app`) to the
  app's allowed origins, or wallet login will be blocked.
- **TxLINE token can expire** — if data returns `503 TXLINE_TOKEN_MISSING`, re-activate and
  update `TXLINE_API_TOKEN` in all three projects.

## Verify after deploy

- `whistl`  → `/matches` lists real World Cup fixtures; a bet settles via `validate_stat`.
- `pulse`   → `/` feed loads fixtures; `/mind` shows ORA's on-chain memos with Explorer links.
- `txagent` → compose a strategy → **Compile** (ACE) → **Run Backtest** (real data) → **Deploy**
  inscribes a call on Solana; the ledger reads it back.

Quick health check: `https://<app>.vercel.app/api/txline/fixtures` should return real fixtures
(not `503`). If it 503s, the `TXLINE_API_TOKEN` env var is missing or expired.

## Notes

- Secrets live only in Vercel env vars + your local `.env.local` (gitignored). None are in the repo.
- The apps share one ORA wallet, so its Solana memo history (the "ORA Mind" / ledger) is unified
  across Pulse and TxAgent by design.
