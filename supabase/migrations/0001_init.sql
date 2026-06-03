-- Auric Iron Matrix - initial schema
-- Ported to match the canonical engine in reference_ui.html.
-- Single shared workspace: any authenticated team member reads and writes the
-- one shared matrix, points, and assumptions.

create extension if not exists "pgcrypto";

-- Five source types, exactly as the reference engine uses them.
do $$ begin
  create type source_type as enum
    ('asking', 'auction', 'sold_private', 'sisp', 'own_close');
exception when duplicate_object then null; end $$;

do $$ begin
  create type currency as enum ('CAD', 'USD');
exception when duplicate_object then null; end $$;

create table if not exists equipment_class (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,           -- e.g. og_gen_g3516; stable import + test key
  sector      text not null,
  category    text not null,
  name        text not null,
  unit        text not null,
  ref_rating  numeric not null,
  ref_spec    jsonb not null,                 -- {hours,cond,encl}; informational, not used in FMV math
  created_at  timestamptz not null default now()
);

create table if not exists data_point (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references equipment_class(id) on delete cascade,
  price       numeric not null check (price > 0),
  currency    currency not null,
  source_type source_type not null,
  rating      numeric check (rating is null or rating > 0),
  hours_band  text,
  condition   text,
  packaging   text,
  config      text,
  sale_date   date,
  source_note text not null check (length(btrim(source_note)) > 0),  -- never accept a point without a source
  created_at  timestamptz not null default now()
);
create index if not exists data_point_class_id_idx on data_point (class_id);

-- Single mutable shared assumptions row. Defaults match reference defSettings().
create table if not exists assumptions (
  id                     uuid primary key default gen_random_uuid(),
  fx_rate                numeric not null default 1.385,
  fx_date                date    not null default date '2026-06-03',
  olv_ratio              numeric not null default 0.70,
  flv_ratio              numeric not null default 0.55,
  ask_to_fmv             numeric not null default 0.85,
  auction_to_fmv         numeric not null default 1.43,
  recency_horizon_months integer not null default 36,
  singleton              boolean not null default true unique,  -- enforces exactly one row
  updated_at             timestamptz not null default now()
);

create table if not exists backtest_run (
  id                   uuid primary key default gen_random_uuid(),
  run_date             timestamptz not null default now(),
  as_of                date not null,
  class_id             uuid references equipment_class(id) on delete cascade,
  n_points             integer not null,
  median_abs_pct_error numeric,             -- null when too few verified points
  notes                text
);
create index if not exists backtest_run_class_id_idx on backtest_run (class_id);

-- Row Level Security: single shared workspace. Authenticated users get full
-- access; anonymous users get nothing. (Tighten to roles later if needed.)
-- Supabase provides the `authenticated`/`anon` roles; create them if missing so
-- this migration also applies against a plain Postgres (local dev / CI).
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
end $$;

alter table equipment_class enable row level security;
alter table data_point      enable row level security;
alter table assumptions     enable row level security;
alter table backtest_run    enable row level security;

do $$
declare t text;
begin
  foreach t in array array['equipment_class','data_point','assumptions','backtest_run']
  loop
    execute format(
      'drop policy if exists %1$s_authenticated_all on %1$s', t);
    execute format(
      'create policy %1$s_authenticated_all on %1$s
         for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
