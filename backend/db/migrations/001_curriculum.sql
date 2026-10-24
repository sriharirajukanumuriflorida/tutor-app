-- Curriculum tables for Aria. Safe to re-run (IF NOT EXISTS). Review before running in the Supabase SQL editor.
-- Card content is seeded from backend/curriculum/cards/*.json by `python -m curriculum.seed`.

create table if not exists concepts (
  id          text primary key,
  grade       smallint not null check (grade in (1, 2)),
  category    text not null,
  title       text not null,
  trick       text not null,
  explain     text not null,
  examples    jsonb not null default '[]',
  exceptions  jsonb not null default '[]',
  i_can       text not null,
  passage     text,
  sort_order  integer not null default 0
);

create table if not exists concept_prereqs (
  concept_id text not null references concepts(id) on delete cascade,
  prereq_id  text not null references concepts(id) on delete cascade,
  primary key (concept_id, prereq_id)
);

-- A question is addressed by (concept_id, idx): its position in the card.
create table if not exists questions (
  concept_id text not null references concepts(id) on delete cascade,
  idx        smallint not null,
  type       text not null check (type in ('choose', 'spell', 'count', 'say', 'open')),
  prompt     text not null,
  answer     text not null default '',
  accept     jsonb not null default '[]',
  level      smallint not null default 1,
  if_right   text not null,
  if_wrong   text not null,
  primary key (concept_id, idx)
);

create table if not exists placement_items (
  position   smallint primary key,
  concept_id text not null references concepts(id) on delete cascade,
  type       text not null,
  prompt     text not null,
  answer     text not null,
  accept     jsonb not null default '[]'
);

create table if not exists child_profiles (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists child_concept_progress (
  child_id     uuid not null references child_profiles(id) on delete cascade,
  concept_id   text not null references concepts(id) on delete cascade,
  attempts     integer not null default 0,
  correct      integer not null default 0,
  mastered     boolean not null default false,
  last_seen_at timestamptz,
  next_review_at timestamptz,
  primary key (child_id, concept_id)
);

-- Existing table: add optional links so old rows keep working.
alter table interactions add column if not exists child_id uuid references child_profiles(id);
alter table interactions add column if not exists concept_id text references concepts(id);
alter table interactions add column if not exists question_idx smallint;

create index if not exists idx_questions_concept on questions(concept_id);
create index if not exists idx_progress_child on child_concept_progress(child_id);
create index if not exists idx_interactions_child on interactions(child_id);
