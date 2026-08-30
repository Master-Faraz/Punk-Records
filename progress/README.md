# Punk Records — Project Overview & Roadmap

> **Core Mission**: Build a fast, personal second brain that turns free time into spaced review and random recall instead of doomscrolling.

---

## 1. System Architecture & Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Framework** | Next.js 16 (App Router) | Core frontend & server actions |
| **State & Data Sync** | TanStack Query (React Query v5) | Client-side caching, optimistic review updates, instant tag filtering |
| **Styling** | Tailwind CSS v4 | Responsive, mobile-first dark design |
| **Rich Text Editor** | Tiptap (ProseMirror JSON) | Native JSON document storage in `jsonb` + image upload |
| **Database & Auth** | Supabase (PostgreSQL, Supabase Auth, RLS) | Secure multi-device data persistence |
| **Media Storage** | Supabase Storage (`record-images`) | Image uploads with public read access |
| **Mobile Experience**| PWA (Manifest + Service Worker) | Native-feeling web app on iOS/Android |

---

## 2. Core V1 Workflows

1. **Quick Capture (<1 min)**: Global modal (`Cmd+K` / FAB button) to capture Title + Content + Source URL with zero forced friction.
2. **Records Vault**: Full CRUD, Tiptap rich editing, custom tags, search, and sorting.
3. **Spaced Review (1 / 7 / 30 days)**:
   - Schedule: `New` → `1 day` → `7 days` → `30 days` (repeats at 30 days).
   - `Forgot`: resets interval stage back to 1 day (`next_review_at = tomorrow`).
   - `Remembered`: advances to next stage (`next_review_at = today + interval`).
   - Tracks review history in `reviews` table and caches state on `records`.
4. **Random Recall Mode ("Anti-Doomscroll")**:
   - Single tap to pull a random card when bored.
   - Filters by tag / unread status / 7-day cooldown period.
   - Increments `read_count` upon review.
5. **PWA Mobile-First Interface**:
   - Bottom navigation bar, responsive layout shell, fast caching.

---

## 3. Implementation Task Breakdown

### Phase 1: Database & Foundation
- [x] **1.1 Supabase Schema & Simple Indexes**
  - Created `records`, `tags`, `record_tags`, and `reviews` tables with constraints and standard indexes.
  - Set up Row Level Security (RLS) policies scoped to `auth.uid()`.
  - Created database function & trigger for `updated_at`.
  - Created `record-images` storage bucket and policies.
- [x] **1.2 Supabase & TanStack Query Setup**
  - Installed `@supabase/supabase-js`, `@supabase/ssr`, and `@tanstack/react-query`.
  - Configured Server / Browser Supabase clients and `QueryClientProvider`.
  - Set up auth proxy (`proxy.ts`) for session refresh.
- [x] **1.3 Base Layout & Navigation**
  - Responsive layout shell (Sidebar on desktop, bottom navigation on mobile).
  - Dark mode design with Tailwind v4.
  - Auth pages (`/auth/login`, `/auth/signup`, `/auth/callback`).

### Phase 2: Editor & Records Vault
- [x] **2.1 Tiptap Editor Integration**
  - Configured Tiptap with starter extensions (Headings, Lists, Code, Links, Images).
  - Built toolbar for mobile & desktop with image upload to Supabase Storage.
  - Read-only `TiptapRenderer` for cards and detail views.
- [x] **2.2 Records CRUD & Vault UI (with TanStack Query)**
  - Query hooks and optimistic mutations for favorites and deletes.
  - Records list / grid view with search (title, URL, tags) and sorting (newest, most read, due first).
  - Individual record detail view (`/records/[id]`) and edit view (`/records/[id]/edit`).
- [x] **2.3 Tagging System**
  - Tag selector component with autocomplete (`TagInput`).
  - Auto-upserts tags and links them via `record_tags`.

### Phase 3: Review Mode & Random Recall
- [x] **3.1 Spaced Repetition Engine**
  - Implemented 1 / 7 / 30 day interval transition logic.
  - History logging in `reviews` + instant mutation on `records`.
- [x] **3.2 Review Mode Interface (`/review`)**
  - Due records badge counter.
  - Card deck UI with revealable content.
  - "Forgot" (reset to day 1) & "Remembered" (advance stage) actions.
  - Celebration state when all due reviews are finished.
- [x] **3.3 Random Recall Mode (`/random`)**
  - Random query supporting tag filters, unread filters, and 7-day cooldown.
  - "Give me another" shuffle trigger with read count increment.

### Phase 4: Quick Capture, Search & PWA
- [x] **4.1 Quick Capture UI**
  - Global floating action button & `Cmd+K` / `Ctrl+K` shortcut modal.
  - Fast paste handler with auto-detection of YouTube/Article links.
- [x] **4.2 Search**
  - Real-time client search across titles, URLs, and tags.
- [x] **4.3 PWA & Polish**
  - `manifest.json` with standalone display configuration.
  - Service worker (`sw.js`) and auto-registration component.

---

## 4. Explicitly Deferred (Post-V1)
- Goal tracking, consistency streaks, and discipline scores.
- Kanban boards / task management.
- Recall quizzes, test modes, and analytics reports.
- Knowledge graph / visual memory map.
- Gamification / XP / Solo Leveling UI.
- AI automated summaries and connection suggestions.
