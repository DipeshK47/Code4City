# Lemontree Volunteer Hub

## What This Is

A volunteer operations platform for flyer-based food access outreach in NYC. Volunteers learn the process, find high-need neighborhoods, locate printers, walk routes distributing flyers, and track their impact. Think "Strava for food access volunteering" — with gamification, community features, and data-driven targeting.

**The core problem:** Free food resources exist but awareness is fragmented. Lemontree coordinates volunteers to distribute flyers in the right places, with the right info, repeatedly.

## Stack

- **Frontend**: Next.js 16 + React 19 (TypeScript), inline styles, Fraunces serif + DM Sans typography, deployed on Vercel
- **Backend**: Node.js + Express 5, PostgreSQL (Supabase), JWT auth (7-day expiry, bcrypt 12 rounds)
- **APIs**: Google Places API v1 (Text Search, Autocomplete, Details), Google Maps, Google Generative AI (Gemini chatbot), OpenStreetMap Overpass API
- **Repo**: Monorepo — `frontend/` and `backend/` with independent `package.json` files
- **Ports**: Frontend `:3000`, Backend `:5001`

## Architecture

```
frontend/                          backend/
├── app/                           ├── src/
│   ├── layout.tsx                 │   ├── app.js          (Express setup, all routes mounted)
│   ├── page.tsx (home)            │   ├── server.js       (entry point, DB init, port 5001)
│   ├── onboarding/                │   ├── routes/         (10 route files)
│   ├── map/                       │   ├── controllers/    (10 controllers)
│   ├── tracker/                   │   ├── services/       (business logic, scoring, distance calc)
│   ├── printers/                  │   ├── data/           (repositories for sessions, stats)
│   ├── leaderboard/               │   ├── db/index.js     (PG pool, schema auto-creation)
│   ├── profile/                   │   ├── middleware/      (requireAuth JWT)
│   ├── community/                 │   └── utils/          (optionalAuth)
│   ├── messages/                  ├── sql/                (DDL scripts)
│   ├── guide/                     └── package.json
│   ├── getstarted/
│   └── api/ (printers, autocomplete, place, chat)
├── components/
├── context/AuthContext.tsx
├── lib/
└── package.json
```

## Volunteer Workflow (The Core Loop)

1. **Sign up** → Onboarding with mission statement + terms acceptance
2. **Learn** → Read the guide (`/guide`) or get-started flow (`/getstarted`)
3. **Find zone** → Map shows food-insecure neighborhoods with hotspot locations scored by priority
4. **Print flyers** → Printer finder locates nearby print shops with real pricing
5. **Walk route** → Tracker records GPS path, stops (flyer drops), duration, distance
6. **Save session** → Stats update: flyers distributed + hours volunteered
7. **Climb leaderboard** → Ranking by weighted score `(flyers × 1.5) + hours`
8. **Earn badges** → First Flyer, 100 Flyers, Streak (2+ consecutive days), Top 5, Top 1
9. **Engage community** → Posts, meetups with group chat, direct messages

## Data Pipeline

**Need Regions** (NYC Open Data → Supabase):
- 197 NYC neighborhoods with food insecurity scores and polygon geometries
- Imported via `POST /api/need-regions/import/nyc-open-data`
- Used for map overlays and hotspot scoring

**Hotspot Locations** (OpenStreetMap Overpass → Supabase):
- 1,500+ locations (libraries, cafes, community centers, etc.)
- Scored by: category weight + metadata richness + region food-need score
- Priority: High (≥8.7), Medium (≥6.3), Low
- Imported via `POST /api/locations/import/osm/nyc` (13 NYC sub-regions)

**Sessions** (Volunteer GPS → Supabase):
- Route points, stops with labels, duration, Haversine distance
- Increments `user_stats` (flyers + hours) and `user_daily_activity` (for streaks)

## Backend API (all mounted, all working)

| Route | Auth | Purpose |
|-------|------|---------|
| `POST /api/auth/signup` | — | Register (username, email, password ≥8 chars) |
| `POST /api/auth/login` | — | Login → JWT |
| `GET /api/auth/me` | JWT | Current user + profile photo |
| `POST /api/auth/agree-terms` | JWT | Accept ToS |
| `POST /api/auth/profile-photo` | JWT | Upload profile image URL |
| `GET /api/locations` | — | 1,500+ hotspot locations |
| `PATCH /api/locations/:id` | — | Mark covered/assigned |
| `POST /api/locations/import/osm/nyc` | — | Bulk OSM import |
| `GET /api/need-regions` | — | 197 food-need regions with geometry |
| `POST /api/need-regions/import/nyc-open-data` | — | Import from NYC Open Data |
| `GET /api/sessions` | JWT | User's route sessions |
| `POST /api/sessions` | JWT | Save route session (updates stats) |
| `GET /api/leaderboard` | — | Rankings (weighted: flyers×1.5 + hours) |
| `GET /api/badges` | JWT | Badge status + current stats |
| `GET /api/activity/recent` | — | Last 5 completed sessions |
| `GET/POST /api/community/posts` | Optional/JWT | Community feed |
| `POST /api/community/posts/:id/like` | JWT | Like/unlike |
| `GET/POST /api/community/posts/:id/comments` | —/JWT | Threaded comments |
| `GET/POST /api/meetups` | Optional/JWT | Meetups with auto-post option |
| `POST /api/meetups/:id/join` | JWT | Join (respects max_attendees) |
| `GET/POST /api/meetups/:id/messages` | JWT | Meetup group chat |
| `GET/POST /api/messages/threads` | JWT | DM threads |
| `GET/POST /api/messages/threads/:id/messages` | JWT | DM messages (auto-read receipts) |

## Frontend Pages

| Page | Route | What It Does |
|------|-------|--------------|
| Home | `/` | Hero, stats, quick actions, recent activity |
| Onboarding | `/onboarding` | Login / Signup / Guest flow with terms |
| Map | `/map` | Interactive outreach map with zone overlays and hotspots |
| Tracker | `/tracker` | GPS route recording, stop logging, session save |
| Printers | `/printers` | Google Places search for print shops with pricing |
| Leaderboard | `/leaderboard` | Podium (top 3), your standing, full rankings table |
| Profile | `/profile` | Stats, badges, sessions, certificate generation |
| Community | `/community` | Posts feed + meetups tab |
| Messages | `/messages` | Direct messaging |
| Guide | `/guide` | Step-by-step volunteer guide |
| Get Started | `/getstarted` | 4-step flow: Learn → Download → Print → Volunteer |

## Frontend API Routes (Next.js server-side, keeps API keys out of browser)

- `GET /api/printers?lat=X&lng=Y` — Google Places Text Search for print shops
- `GET /api/autocomplete?input=...` — Google Places Autocomplete
- `GET /api/place?id=...` — Place Details (coordinates by place_id)
- `POST /api/chat` — Gemini AI chatbot

## Citrus Chatbot (Gemini AI)

A floating 🍋 button on every page opens "Citrus", a Gemini-powered assistant (`gemini-3.1-flash-lite-preview`).

- **API route**: `POST /api/chat` (Next.js server-side, streams responses, keeps `GEMINI_API_KEY` out of browser)
- **System prompt** gives it full Lemontree context: volunteer workflow, flyering tips (good locations, legal rules like "never put flyers in mailboxes — federal offense"), print shop pricing for all chains, and descriptions of every app feature
- **In-app linking**: Responses can include `[LINK:PAGE_NAME]` tags (GET_STARTED, GUIDE, PRINTERS, MAP, LEADERBOARD, PROFILE, FLYERS) that render as clickable buttons navigating the user to the right page
- **Conversation history** maintained in-memory per session for context continuity
- **Streaming**: Responses stream token-by-token with animated typing indicator
- **Suggested prompts** on first open: "How do I get started?", "Where can I print flyers?", "How do I flyer?", "How does the map work?"
- **Component**: `frontend/components/chat/ChatbotWidget.tsx`, mounted globally in `AppShell.tsx`

Note: The chatbot is separate from the DM and meetup chat features, which use the backend PostgreSQL database (dm_threads, dm_messages, meetup_messages tables).

## Key Design Decisions

- **Inline styles everywhere** — no CSS modules or styled-components; all styling is inline React `style={}` objects with Fraunces for headings and DM Sans for body
- **Optional auth on public routes** — community posts, meetups, leaderboard viewable without login; auth adds viewer-specific data (liked? joined?)
- **Soft deletes** — community posts and comments use `deleted_at` to preserve thread integrity
- **Haversine distance** — calculated server-side from route points when client doesn't provide distance
- **Coordinate prefetching** — printer autocomplete fetches coords in parallel with suggestions so selection is instant
- **Transaction safety** — meetup creation (meetup + auto-post) wrapped in BEGIN/COMMIT; DM thread creation ensures exactly 2 members
- **OSM scoring algorithm** — locations scored by category (library=9.5, cafe=7.8...) + metadata richness + food-need region overlay

## Environment Variables

**Backend** (`backend/.env`):
- `DATABASE_URL` — Supabase PostgreSQL connection string (required)
- `JWT_SECRET` — signing key (required)
- `PORT` — default 5001

**Frontend** (`frontend/.env.local`):
- `GOOGLE_MAPS_API_KEY` — Google Places API v1 key
- `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_API_BASE_URL` — backend URL (naming inconsistency exists)
- `GEMINI_API_KEY` — Google Generative AI

## Running Locally

```bash
# Backend
cd backend && npm install && npm run dev   # port 5001

# Frontend
cd frontend && npm install && npm run dev  # port 3000
```

## Team

- **Sharvin Gavad** — Lead architect, onboarding, map, community/meetup/chat features
- **John Ortega** — Auth flow, profile/leaderboard UI, certificate generation
- **Matheus** — Printer tab (Google Places integration), route/onboarding refactoring
- **Akshat** — Data import, map/outreach features
- **Pratzz1202** — Verification feature

## Branch Strategy

`main` → feature branches → PRs. Key branches: `printers`, `get-started`, `onboarding`, `chatbot`, `profiles`, `newfeature-ui` (current).
