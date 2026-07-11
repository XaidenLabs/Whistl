-- Serverless Telegram bots — run once in the Supabase SQL editor (the same project all three apps use).
-- One shared database, namespaced by `bot` (whistl / pulse / trader) so the three bots do not collide.
-- Access is server-side via the service-role key, so RLS is on with no policies.

create table if not exists telegram_subs (
  bot        text   not null,
  chat_id    bigint not null,
  created_at timestamptz not null default now(),
  primary key (bot, chat_id)
);

create table if not exists telegram_match_state (
  bot        text   not null,
  fixture_id bigint not null,
  g1 int not null default 0,
  g2 int not null default 0,
  c1 int not null default 0,
  c2 int not null default 0,
  finished boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (bot, fixture_id)
);

alter table telegram_subs enable row level security;
alter table telegram_match_state enable row level security;
