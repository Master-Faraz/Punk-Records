# ⚡ Punk Records

> Personal second brain for quick capture, spaced repetition, and random recall. Built as an offline-first PWA to replace doomscrolling.

[![Next.js 16](https://img.shields.io/badge/Next.js-16.3-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19.2-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript 5](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS 4](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_|_Auth_|_Storage-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com/)
[![PWA](https://img.shields.io/badge/PWA-Offline--First-orange?style=flat-square)](https://web.dev/progressive-web-apps/)

---

## ✨ Features

- **⚡ Quick Capture (<60s)**: Frictionless notes with auto-detected sources (YouTube, articles, books, notes).
- **🧠 Spaced Review (1 / 7 / 30 Days)**: Automated Leitner review queue with active recall (Forgot / Remembered).
- **🎲 Random Recall**: "Give me something" shuffle with configurable 7-day cooldown to browse your own curated knowledge instead of social media.
- **📝 Rich TipTap Editor**: Headless editor storing structured AST JSON in PostgreSQL (prevents XSS, preserves formatting).
- **🖼️ Automated Image Pipeline**: Server-side WebP conversion and EXIF stripping via Sharp (max 1600px width), with auto-cleanup of orphaned images on deletion.
- **📶 Offline-First PWA**: Custom Service Worker + IndexedDB outbox queue. Create, edit, and review offline — auto-syncs when back online.
- **🏷️ Tag Management**: Multi-tagging with instant search, filtering, and favorites.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **UI & Styling**: React 19, Tailwind CSS v4, Lucide Icons
- **Editor**: TipTap (StarterKit, Image, Link, YouTube, TaskList)
- **Database & Auth**: Supabase (PostgreSQL with RLS, Supabase Auth SSR, Supabase Storage)
- **State & Offline**: TanStack React Query v5, IndexedDB, Custom Service Worker
- **Media Processing**: Sharp

---

## 🚀 Quick Start

### 1. Prerequisites

- Node.js 20+
- pnpm 10+ (`corepack enable && corepack prepare pnpm@latest --activate`)
- A [Supabase](https://supabase.com) project

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Environment Variables

Create `.env.local` from the example:

```bash
cp .env.example .env.local
```

Set your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

> **Security Note**: Never add `SUPABASE_SERVICE_ROLE_KEY` here. The client and SSR middleware operate strictly with the public anon key and authenticated user sessions.

### 4. Database Setup

Run the SQL migration in your Supabase SQL Editor:

1. Copy the contents of [`supabase/schema.sql`](supabase/schema.sql).
2. Execute the script in your Supabase **SQL Editor**.
   - Creates all tables (`records`, `tags`, `record_tags`, `reviews`, `user_settings`).
   - Enables Row Level Security (RLS) on all tables.
   - Configures the `record-images` storage bucket (5MB limit, WebP/PNG/JPEG/GIF only).

### 5. Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 🔒 Security & Data Protection

- **Row Level Security (RLS)**: Enforced on all PostgreSQL tables. Every query is filtered by `auth.uid() = user_id`. Users can only access and modify their own data.
- **Storage Isolation**: Uploads to the `record-images` bucket require the path format `{user_id}/*`. Users cannot view or delete files belonging to other user IDs.
- **Image Sanitization**: All uploaded media goes through `/api/upload`, where `sharp` strips EXIF metadata, downsizes images over 1600px, and re-encodes to WebP (q: 80).
- **Session & Auth Guard**: Next.js 16 `proxy.ts` automatically refreshes SSR session cookies and protects authenticated routes (`/`, `/review`, `/random`, `/editor`, `/settings`) without client-side redirect flicker.
- **Safe Content Storage**: TipTap content is stored as sanitized JSON AST (`jsonb`), preventing raw HTML injection or stored XSS.

---

## 📁 Project Structure

```
punk-records/
├── app/
│   ├── api/upload/route.ts      # Server-side Sharp WebP image processing
│   ├── auth/                    # Login, Signup, Auth Callback
│   ├── editor/                  # TipTap editor (new/edit records)
│   ├── random/                  # Random recall mode ("Give me something")
│   ├── records/[id]/            # View record details
│   ├── review/                  # Spaced review interface (due cards)
│   ├── settings/                # Review interval & cooldown preferences
│   ├── layout.tsx               # Root layout, fonts, PWA registration
│   └── page.tsx                 # Vault dashboard (search, filter, list)
├── components/
│   ├── capture/                 # Quick capture modal & sync actions
│   ├── editor/                  # TipTap editor, toolbar, renderer
│   ├── layout/                  # AppShell, Sidebar, BottomNav
│   ├── media/                   # YouTube player embed, image viewer
│   ├── pwa/                     # Service worker register, offline badge
│   └── tags/                    # Tag selector & filter pills
├── lib/
│   ├── offline/                 # IndexedDB, outbox queue & auto-sync engine
│   ├── settings.ts              # Interval calculation logic
│   └── supabase/                # Supabase client, server, middleware & asset cleanup
├── public/
│   ├── manifest.json            # PWA manifest
│   └── sw.js                    # Service worker (cache-first runtime)
├── supabase/
│   └── schema.sql               # Database schema & RLS policies
├── proxy.ts                     # Next.js 16 session middleware proxy
└── types/database.ts            # TypeScript interfaces
```

---

## 📜 Scripts

| Command | Description |
| :--- | :--- |
| `pnpm dev` | Start development server with Turbopack |
| `pnpm build` | Build production bundle |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint check |

---

## 🚢 Production Deployment

1. **Vercel**: Connect your repository, select Next.js, and add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to your environment variables.
2. **Supabase Auth**: In Supabase Dashboard → Auth → URL Configuration, add your production domain to **Redirect URLs** (e.g., `https://your-domain.com/auth/callback`).
3. **PWA**: Verify the service worker and manifest are served properly over HTTPS.

---

## 📄 License

MIT
