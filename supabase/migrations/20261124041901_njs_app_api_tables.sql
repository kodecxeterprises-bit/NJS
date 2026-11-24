-- Tables required by the deployed Cloudflare API for saved prospects and outreach drafts.
create table if not exists public.saved_leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_business_id uuid references public.business_profiles(id) on delete set null,
  company_name text not null,
  domain text,
  contact_name text,
  contact_role text,
  location text,
  industry text,
  score text,
  notes text,
  tags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists saved_leads_user_target_unique
  on public.saved_leads(user_id, target_business_id) where target_business_id is not null;
create index if not exists saved_leads_user_created_idx on public.saved_leads(user_id, created_at desc);

create table if not exists public.outreach_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid references public.saved_leads(id) on delete set null,
  lead_name text not null default 'Business contact',
  goal text not null default '',
  tone text not null default 'professional',
  content text not null default '',
  status text not null default 'draft' check (status in ('draft','approved','sent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists outreach_drafts_user_created_idx on public.outreach_drafts(user_id, created_at desc);

alter table public.saved_leads enable row level security;
alter table public.outreach_drafts enable row level security;
drop policy if exists "Users manage their own saved leads" on public.saved_leads;
create policy "Users manage their own saved leads" on public.saved_leads
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Users manage their own outreach drafts" on public.outreach_drafts;
create policy "Users manage their own outreach drafts" on public.outreach_drafts
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- These tables are accessed by the authenticated Cloudflare Worker using its server-only key.
grant all on table public.saved_leads, public.outreach_drafts to service_role;
