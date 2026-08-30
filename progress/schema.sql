-- ==============================================================================
-- PUNK RECORDS — Supabase / PostgreSQL Schema (V1)
-- ==============================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. RECORDS TABLE
-- ------------------------------------------------------------------------------
create table if not exists public.records (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    title text not null,
    thumbnail_url text,
    content jsonb not null default '{}'::jsonb,
    source_url text,
    source_type text default 'note' check (source_type in ('youtube', 'article', 'book', 'note', 'other')),
    is_favorite boolean not null default false,
    is_archived boolean not null default false,
    read_count integer not null default 0,
    review_stage integer not null default 0, -- 0: new, 1: 1-day, 2: 7-day, 3: 30-day
    last_reviewed_at timestamptz,
    next_review_at timestamptz default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 2. TAGS TABLE
-- ------------------------------------------------------------------------------
create table if not exists public.tags (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    created_at timestamptz not null default now(),
    unique (user_id, name)
);

-- ------------------------------------------------------------------------------
-- 3. RECORD_TAGS (JOIN TABLE)
-- ------------------------------------------------------------------------------
create table if not exists public.record_tags (
    record_id uuid not null references public.records(id) on delete cascade,
    tag_id uuid not null references public.tags(id) on delete cascade,
    primary key (record_id, tag_id)
);

-- ------------------------------------------------------------------------------
-- 4. REVIEWS (HISTORY TABLE)
-- ------------------------------------------------------------------------------
create table if not exists public.reviews (
    id uuid primary key default uuid_generate_v4(),
    record_id uuid not null references public.records(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    scheduled_for timestamptz,
    reviewed_at timestamptz not null default now(),
    result text not null check (result in ('remembered', 'forgot')),
    previous_stage integer not null default 0,
    next_stage integer not null default 1,
    created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 5. INDEXES FOR PERFORMANCE & SORTING
-- ------------------------------------------------------------------------------
create index if not exists idx_records_user_id on public.records(user_id);
create index if not exists idx_records_next_review on public.records(user_id, next_review_at) where is_archived = false;
create index if not exists idx_records_read_count on public.records(user_id, read_count);
create index if not exists idx_records_user_created on public.records(user_id, created_at desc) where is_archived = false;
create index if not exists idx_tags_user_id on public.tags(user_id);
create index if not exists idx_record_tags_tag_id on public.record_tags(tag_id);
create index if not exists idx_reviews_record_id on public.reviews(record_id);
create index if not exists idx_reviews_user_id on public.reviews(user_id);

-- ------------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------------
alter table public.records enable row level security;
alter table public.tags enable row level security;
alter table public.record_tags enable row level security;
alter table public.reviews enable row level security;

-- Records Policies
create policy "Users can view their own records"
    on public.records for select
    using (auth.uid() = user_id);

create policy "Users can insert their own records"
    on public.records for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own records"
    on public.records for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users can delete their own records"
    on public.records for delete
    using (auth.uid() = user_id);

-- Tags Policies
create policy "Users can view their own tags"
    on public.tags for select
    using (auth.uid() = user_id);

create policy "Users can insert their own tags"
    on public.tags for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own tags"
    on public.tags for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users can delete their own tags"
    on public.tags for delete
    using (auth.uid() = user_id);

-- Record Tags Policies
create policy "Users can view their record_tags"
    on public.record_tags for select
    using (exists (
        select 1 from public.records
        where records.id = record_tags.record_id and records.user_id = auth.uid()
    ));

create policy "Users can insert their record_tags"
    on public.record_tags for insert
    with check (exists (
        select 1 from public.records
        where records.id = record_tags.record_id and records.user_id = auth.uid()
    ));

create policy "Users can delete their record_tags"
    on public.record_tags for delete
    using (exists (
        select 1 from public.records
        where records.id = record_tags.record_id and records.user_id = auth.uid()
    ));

-- Reviews Policies
create policy "Users can view their own reviews"
    on public.reviews for select
    using (auth.uid() = user_id);

create policy "Users can insert their own reviews"
    on public.reviews for insert
    with check (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 7. UPDATED_AT TRIGGER
-- ------------------------------------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create or replace trigger set_records_updated_at
    before update on public.records
    for each row
    execute function public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 8. SUPABASE STORAGE BUCKET & POLICIES
-- ------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'record-images',
    'record-images',
    true,
    5242880, -- 5 MB limit
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- Storage Policies
create policy "Authenticated users can upload record images"
    on storage.objects for insert
    to authenticated
    with check (
        bucket_id = 'record-images' and
        (storage.foldername(name))[1] = auth.uid()::text
    );

create policy "Public can view record images"
    on storage.objects for select
    using (bucket_id = 'record-images');

create policy "Users can delete their own record images"
    on storage.objects for delete
    to authenticated
    using (
        bucket_id = 'record-images' and
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- ------------------------------------------------------------------------------
-- 9. USER SETTINGS TABLE (CUSTOM REVIEW TIMINGS & PREFERENCES)
-- ------------------------------------------------------------------------------
create table if not exists public.user_settings (
    user_id uuid primary key references auth.users(id) on delete cascade,
    stage_1_days integer not null default 1,
    stage_2_days integer not null default 7,
    stage_3_days integer not null default 30,
    random_cooldown_days integer not null default 7,
    updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy "Users can view their own settings"
    on public.user_settings for select
    using (auth.uid() = user_id);

create policy "Users can insert their own settings"
    on public.user_settings for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own settings"
    on public.user_settings for update
    using (auth.uid() = user_id);

