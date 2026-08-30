# Punk Records — V1 Specification (Scoped)

> **Goal:** Ship a working second brain today and start using it daily.
>
> V1 = knowledge vault + spaced review + random recall. Nothing else.
>
> Goal tracking, leveling, memory map, kanban, recall quizzes — all deferred. Build those only after this loop is a real daily habit.

---

## 1. Problem

- Learn a lot (YouTube, dev content, communication, English, book summaries) but forget most of it within 2–3 weeks.
- Free time defaults to doomscrolling instead of revisiting useful things.

## 2. Solution

Capture → store as rich content → get reminded to review at spaced intervals (default 1 / 7 / 30 days, interval configurable later) → also get random content to browse when bored, as a doomscroll replacement.

## 3. V1 Feature List

1. Records (CRUD)
2. Rich content via Tiptap (stored as JSON in DB, not raw HTML)
3. Custom tags (create, rename, delete, filter, search)
4. Global search (title, content, tags, source URL)
5. Spaced review (fixed 1/7/30 day schedule, Forgot/Remembered)
6. Review mode (dedicated screen, shows due records)
7. Random mode (repeat toggle + cooldown, read counter)
8. Quick capture (title + paste content/link, save in <1 min)
9. PWA (installable, works well on mobile — this is what replaces doomscrolling)

Everything else from the original brainstorm (daily goals, dashboard, streaks, kanban, leveling, memory map, recall quizzes) is **out of scope** — see §8.

## 4. Records

**Fields:**
```
id
user_id
title
content        -- Tiptap JSON
source_url
source_type     -- youtube | article | book | note | other
tags            -- via record_tags join
is_favorite
is_archived
read_count
last_reviewed_at
next_review_at
created_at
updated_at
```

## 5. Rich Content — Tiptap

- Store `content` as Tiptap's JSON document format directly in Postgres (`jsonb` column) — not HTML.
- Supported node types for V1: paragraph, heading, bold/italic, code block, link, image, bullet/ordered list.
- Images: upload to Supabase Storage, insert the resulting URL as a Tiptap image node. Optimize with Sharp on upload (resize/compress) — keep this dead simple, no on-the-fly transforms.
- Rendering the JSON back to read-only view: use Tiptap's read-only editor instance or a JSON-to-HTML renderer — don't hand-roll a parser.

## 6. Tags

- Many-to-many via `record_tags`.
- User-created, freeform (e.g. `#web-dev`, `#AI`, `#books`, `#english`, `#communication`).
- Filter records by tag; tag autocomplete in search.

## 7. Spaced Review

**Schedule (fixed for V1, editable per-record later if needed):**
```
New → 1 day → 7 days → 30 days → (repeat at 30 days, or mark mastered later)
```

**On review:**
```
Forgot      → next_review_at = tomorrow, stage resets to 1-day step
Remembered  → advance to next interval
```

Store each review event in a `reviews` table (history), and cache the latest `read_count` / `last_reviewed_at` / `next_review_at` on the `records` row for fast dashboard/list reads.

## 8. Review Mode

- Shows count of records due today.
- One-at-a-time card: title, tags, content, source, read count, last/next review dates.
- Two actions: **Forgot** / **Remembered**.

## 9. Random Mode

- "Give me something" button → pulls a random record.
- Filters: All / Unread / Not recently read / specific tag.
- Toggle: include previously-read records, with a cooldown (e.g. 7 days) to avoid repeats too soon.
- Shows read count on the card.

## 10. Quick Capture

- One field for title, one for content/link/paste. Save in under a minute.
- No forced tagging or categorization at capture time — organize later.

## 11. Database (Supabase / Postgres)

```
users            (Supabase Auth)

records
  id, user_id, title, content (jsonb), source_url, source_type,
  is_favorite, is_archived, read_count, last_reviewed_at,
  next_review_at, created_at, updated_at

tags
  id, user_id, name, created_at

record_tags
  record_id, tag_id

reviews
  id, record_id, user_id, scheduled_for, reviewed_at,
  result, previous_stage, next_stage
```

Row Level Security on all tables — every row scoped to `auth.uid()`.

## 12. Stack

```
Frontend        Next.js 16
Editor          Tiptap (JSON stored in Postgres jsonb)
Database        Supabase Postgres
Auth            Supabase Auth
Storage         Supabase Storage
Image opt.      Sharp (basic resize/compress on upload only)
PWA             Web App Manifest + service worker
```

## 13. Explicitly Out of Scope for V1

Deferred until the review loop is an actual daily habit — reconsider as separate features (or a separate app) after a few weeks of real use:

- Daily/weekly/monthly/yearly goal tracking, check-ins, dashboards, streak calendars
- Discipline/consistency scoring
- Kanban / task management
- Recall quiz mode + analysis report
- Memory map / knowledge graph
- Leveling system / XP / achievements / Solo Leveling-style UI
- AI-generated summaries, questions, or connections
- Multi-user, sharing, collaboration
- Offline-first sync (online-only PWA is fine for V1)

## 14. Success Criteria

You're using it if, starting today, you can:

- Capture something in under a minute
- Tag it and find it later via search
- Get a due-review reminder and honestly mark Forgot/Remembered
- Hit "Give me something" during a free 5 minutes instead of opening social media
- See your read count go up on things you keep coming back to
