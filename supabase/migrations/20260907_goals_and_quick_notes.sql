-- ==============================================================================
-- Migration: 20260907_goals_and_quick_notes.sql
-- Description: Adds goals and quick_notes tables with RLS and indexes
-- ==============================================================================

-- 1. GOALS TABLE
create table if not exists public.goals (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    title text not null,
    description text,
    links jsonb not null default '[]'::jsonb, -- Array of { url: string, title?: string }
    deadline_date date,
    is_completed boolean not null default false,
    completed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.goals enable row level security;

-- Goals Policies
create policy "Users can view their own goals"
    on public.goals for select
    using (auth.uid() = user_id);

create policy "Users can insert their own goals"
    on public.goals for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own goals"
    on public.goals for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users can delete their own goals"
    on public.goals for delete
    using (auth.uid() = user_id);

-- Indexes for performance
create index if not exists idx_goals_user_id on public.goals(user_id);
create index if not exists idx_goals_user_status on public.goals(user_id, is_completed, deadline_date);

-- Updated at trigger
create or replace trigger set_goals_updated_at
    before update on public.goals
    for each row
    execute function public.handle_updated_at();

-- 2. QUICK NOTES TABLE
create table if not exists public.quick_notes (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    title text not null,
    description text not null,
    is_pinned boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.quick_notes enable row level security;

-- Quick Notes Policies
create policy "Users can view their own quick notes"
    on public.quick_notes for select
    using (auth.uid() = user_id);

create policy "Users can insert their own quick notes"
    on public.quick_notes for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own quick notes"
    on public.quick_notes for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users can delete their own quick notes"
    on public.quick_notes for delete
    using (auth.uid() = user_id);

-- Indexes for performance
create index if not exists idx_quick_notes_user_id on public.quick_notes(user_id);
create index if not exists idx_quick_notes_user_pinned on public.quick_notes(user_id, is_pinned desc, created_at desc);

-- Updated at trigger
create or replace trigger set_quick_notes_updated_at
    before update on public.quick_notes
    for each row
    execute function public.handle_updated_at();
