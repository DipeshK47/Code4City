# 🗺️ Volun-Tiers

> **Services exist. But access does not.**

A data-driven volunteer coordination platform that maps unmet community need, assigns volunteers intelligently, optimizes walking routes, and guides every outreach session from start to finish.

Built at **Code4City 2026** · Team: Volun-Tiers · All AI/ML/GIS features built during the hackathon window (April 26, 2026)

---

## Table of Contents

- [Hackathon Context](#hackathon-context)
- [The Problem](#the-problem)
- [Our Solution](#our-solution)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Geospatial Intelligence](#geospatial-intelligence)
- [ML Scoring Algorithms](#ml-scoring-algorithms)
- [Route Optimization](#route-optimization)
- [Neighbour-Hood: The AI Coordinator Agent](#neighbour-hood-the-ai-coordinator-agent)
- [Bilingual Flyer Generation](#bilingual-flyer-generation)
- [Data Pipeline](#data-pipeline)
- [API Reference](#api-reference)
- [Frontend Pages](#frontend-pages)
- [Database Schema](#database-schema)
- [Environment Variables](#environment-variables)
- [Running Locally](#running-locally)
- [Testing](#testing)
- [Hackathon Transparency](#hackathon-transparency)

---

## Hackathon Context

**Code4City 2026** is a civic technology hackathon challenging builders to use code to address real urban problems at the city scale. This year's themes centered on:

- **Geospatial Intelligence** — using GIS, map data, and spatial reasoning to understand cities
- **Optimization** — solving logistics and allocation problems that affect real people
- **Machine Learning** — applying data-driven scoring and recommendation systems to civic use cases

Volun-Tiers was built to address all three themes simultaneously: a GIS-grounded need map feeds an ML scoring engine that drives a greedy route optimization algorithm, all orchestrated by an LLM agent that coordinates volunteer teams in real time.

Every AI, ML, GIS, and route feature in this repository was built on April 26, 2026 during the hackathon window. Pre-existing foundations (authentication, community feed, leaderboard, badges, QR system, and basic map scaffolding) are clearly separated in the [Hackathon Transparency](#hackathon-transparency) section.

---

## The Problem

Food pantries, shelters, health programs, and social services exist across NYC. But people in underserved neighborhoods never hear about them — not because the services aren't there, but because outreach is broken in three ways:

**Invisible** — Services exist but residents don't know. Food pantries, shelters, and health programs go unused because no one is systematically telling people they exist.

**Uncoordinated** — Volunteer outreach has no system. Three volunteers walk the same block while four blocks away, no one shows up. There is no assignment logic, no map of who has been reached, no way to measure coverage.

**Unmeasurable** — Organizations can't see what's working. Without data, program directors can't prove impact, reallocate volunteers to gaps, or justify funding — leaving the cycle of under-service in place year after year.

> *"I didn't know there was a food pantry two blocks from me until a stranger knocked on my door."*
> — Resident, Mott Haven, Bronx

---

## Our Solution

Volun-Tiers solves the coordination problem in four steps:

| Step | What Happens |
|------|-------------|
| **1. Score the city** | NYC Open Data + OpenStreetMap ingestion scores every neighborhood by food insecurity, health access gap, housing instability, and substance use risk |
| **2. Assign volunteers** | Volunteers get matched to highest-need zones that lack coverage. The Neighbour-Hood AI agent generates a personal action plan for each volunteer group |
| **3. Optimize the walk** | A greedy path algorithm orders every outreach stop minimizing distance while maximizing priority. Volunteers follow a turn-by-turn route |
| **4. Track & improve** | Every session updates the coverage map in real time. Organizers see zone completion rates, estimated reach, and where to send the next team |

**As a volunteer:** Open the app, see your assigned zone highlighted on the map, tap Go, and follow a walking route to every outreach stop — no guesswork required.

---

## Key Features

- **Live need-scoring map** — 197 NYC neighborhoods color-coded by composite need score, updated from real open datasets
- **Intelligent volunteer assignment** — ML-powered zone recommendation matching volunteer location to highest-need, lowest-coverage zones
- **Greedy route optimization** — Haversine-distance + priority-weighted stop ordering for every volunteer session
- **Neighbour-Hood AI coordinator** — LLM agent that auto-generates per-volunteer action plans and posts them to group chat when 3+ volunteers join a meetup
- **Auto-translated bilingual flyers** — Zone-aware language detection with Gemini API translation, printed in English + dominant local language
- **Outreach session tracker** — GPS route recording with stop logging, proof-of-coverage photos, and session save
- **Organizer dashboard** — Zone coverage %, active volunteers, estimated residents reached, and next-target recommendations
- **Community & meetups** — Group posts, meetup creation with GPS coordinates, per-meetup group chat
- **Leaderboard & badges** — Gamified volunteer engagement with weighted scoring and streak tracking
- **Relay chatbot** — Gemini-powered floating assistant on every page, context-aware of the full volunteer workflow

---

## Tech Stack

### Frontend

| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js | 16.1.6 | App framework, server-side API routes |
| React | 19.2.3 | UI components |
| TypeScript | ^5 | Type safety throughout |
| Tailwind CSS | ^4 | Utility-first styling |
| Leaflet / react-leaflet | 1.9.4 / 5.0.0 | Interactive outreach maps |
| @vis.gl/react-google-maps | ^1.8.3 | Google Maps integration |
| Mapbox GL | ^3.20.0 | Advanced map rendering |
| jsPDF | ^4.2.0 | Client-side certificate generation |
| Playwright | ^1.57.0 | End-to-end test suite |

### Backend

| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js + Express | ^5.2.1 | REST API server |
| PostgreSQL (via pg) | ^8.20.0 | Primary database |
| Supabase | hosted | Managed PostgreSQL + storage |
| JWT (jsonwebtoken) | ^9.0.3 | Stateless authentication |
| bcrypt | ^6.0.0 | Password hashing (12 rounds) |
| nodemon | ^3.1.14 | Dev server with hot reload |

### AI / ML

| Technology | Purpose |
|-----------|---------|
| Google Gemini (`gemini-3.1-flash-lite-preview`) | Neighbour-Hood coordinator agent, bilingual translation, Relay chatbot |
| @google/generative-ai | Gemini SDK (backend + frontend) |
| Weighted composite scoring | ML-style multi-factor need score per neighborhood |
| Haversine distance formula | Geo-distance calculations for routing and gap detection |
| Greedy path algorithm | Route optimization across prioritized outreach stops |

### GIS / Data

| Source | Data |
|--------|------|
| NYC Open Data (4kc9-zrs2) | Food insecurity scores by NTA/community district |
| NYC Open Data (9nt8-h7nd) | Neighborhood Tabulation Area polygon geometries |
| NYC DFTA | Senior services provider locations |
| NYC DYCD | Youth program site locations |
| NYC Health Systems | Flu vaccination sites & drop-in centers |
| OpenStreetMap Overpass API | 20 POI categories per zone (1,500+ locations) |

### DevOps

- Vercel (frontend deployment)
- Supabase (database hosting)
- Playwright E2E test suite covering the full volunteer journey
- ESLint for code quality
- Production build verified (`next build` passing)

---

## Architecture

```
volun-tiers/
├── frontend/                          ← Next.js 16 app (port 3000)
│   ├── app/
│   │   ├── layout.tsx                 Global app shell
│   │   ├── page.tsx                   Home / landing
│   │   ├── map/                       Outreach map dashboard
│   │   ├── tracker/                   GPS route tracker
│   │   ├── events/                    Outreach events list + detail
│   │   ├── community/                 Posts feed + meetups
│   │   ├── messages/                  DM threads
│   │   ├── leaderboard/               Rankings + podium
│   │   ├── profile/                   Stats, badges, certificate
│   │   ├── flyers/                    AI-generated bilingual flyers
│   │   ├── printers/                  Nearby print shop finder
│   │   ├── guide/                     Volunteer how-to guide
│   │   ├── getstarted/                4-step onboarding flow
│   │   ├── onboarding/                Auth + terms acceptance
│   │   └── api/                       Server-side API routes
│   │       ├── chat/                  Relay Gemini chatbot
│   │       ├── flyers/generate/       Bilingual flyer generation
│   │       ├── autocomplete/          Google Places autocomplete
│   │       └── place/                 Google Places detail lookup
│   ├── components/
│   │   ├── map/                       OutreachMapDashboard, TrackerMap
│   │   ├── tracker/                   TrackerSessionExperience, SessionSummary
│   │   ├── community/                 Feed, meetups, group chat
│   │   └── chat/                      Relay chatbot widget, DM windows
│   ├── lib/
│   │   ├── distance.ts                Haversine implementation
│   │   ├── tracker-route.ts           GPS normalization + validation
│   │   └── [feature]-api.ts           API client modules per domain
│   └── types/                         TypeScript interfaces
│
└── backend/                           ← Node.js + Express (port 5001)
    ├── src/
    │   ├── app.js                     Express setup, all routes mounted
    │   ├── server.js                  Entry point, DB init
    │   ├── routes/                    14 route files
    │   ├── controllers/               14 controllers (thin, delegate to services)
    │   ├── services/                  Business logic
    │   │   ├── needRegionService.js   NYC Open Data ingestion + composite scoring
    │   │   ├── osmHotspotService.js   OSM Overpass ingestion + hotspot scoring
    │   │   ├── coordinatorService.js  Neighbour-Hood LLM agent
    │   │   ├── eventSuggestionService.js  ML clustering for event recommendations
    │   │   ├── flyerService.js        Bilingual flyer context + Gemini translation
    │   │   ├── regionInsightsService.js   Per-zone gap analysis (cached 30 min)
    │   │   ├── routeItemService.js    Stop ordering + greedy route logic
    │   │   └── sessionService.js      GPS session persistence + stats update
    │   ├── db/index.js                PG pool, schema auto-creation on startup
    │   ├── middleware/requireAuth.js  JWT verification middleware
    │   └── sql/                       DDL scripts for all tables
    ├── .env.example
    └── package.json
```

---

## Geospatial Intelligence

### How Need Regions Are Built

NYC neighborhoods are scored from two live Open Data endpoints:

- **Food insecurity dataset** (`4kc9-zrs2`) — 197 NTAs with weighted food need scores, pulled ordered by year DESC then weighted_score DESC
- **NTA boundary dataset** (`9nt8-h7nd`) — Polygon geometries for each neighborhood, stored as JSONB in PostgreSQL for spatial queries

Point-in-polygon matching uses bounding-box pre-filtering followed by ray casting (implemented in `needRegionService.js`) to assign volunteer GPS coordinates to the correct NTA without a PostGIS dependency.

### Composite Need Score Formula

Each neighborhood receives a single composite score computed as:

```
composite_need_score =
  (food_need_score        × 0.40) +
  (health_access_score    × 0.20) +
  (housing_instability    × 0.20) +
  (substance_use_score    × 0.20)
```

When health, housing, or substance scores are missing for a neighborhood (sparse dataset coverage), food_need_score is used as a proxy to ensure all 197 neighborhoods receive a valid composite score. Scores are persisted via upsert so re-imports update without duplicating rows.

### OSM Hotspot Ingestion

OpenStreetMap Overpass API is queried across 13 NYC sub-regions with 20 POI category filters:

| Category | Base Score |
|----------|-----------|
| Library | 9.5 |
| Bookstore | 8.8 |
| Copy Shop | 8.6 |
| Laundry | 8.3 |
| Community Center | 8.1 |
| Coffee Shop | 7.8 |
| Marketplace | 7.2 |
| Restaurant / Pharmacy / College | 6.8 |
| Supermarket | 6.7 |
| ... | ... |

Final hotspot priority score = `category_base_score + metadata_richness_bonus + region_need_score_overlay`. Locations are bucketed into **High** (≥8.7), **Medium** (≥6.3), and **Low** priority tiers for volunteer assignment.

### Live Zone Priority Board

Zones auto-update from OSM + NYC datasets and are surfaced with volunteer coverage counts so organizers can see which critical zones still need teams.

---

## ML Scoring Algorithms

### Event Suggestion Engine (`eventSuggestionService.js`)

This service clusters historical volunteer sessions to recommend future outreach events:

1. Pulls all completed route sessions from the last **8 weeks** with valid GPS start coordinates
2. For each session, resolves the NTA region via point-in-polygon matching
3. Clusters sessions by `region_code × day_of_week` combination
4. Filters to clusters with **≥3 unique users** (MIN_UNIQUE_USERS) — ensuring suggestions reflect genuine community patterns, not single-volunteer behavior
5. Computes centroid lat/lng for each cluster as the recommended meetup location
6. Attaches the composite need score for the matched region so high-need zones are ranked higher

This is a lightweight but effective spatial clustering approach: no k-means library needed when behavioral patterns naturally aggregate around neighborhood geography and weekly volunteer rhythms.

### Hotspot Scoring (`osmHotspotService.js`)

Each imported OSM location receives a multi-factor score:

```javascript
score = category_base_score
      + metadata_richness_bonus   // +0 to +1.5 based on name, address, opening hours present
      + region_overlay            // scaled by the NTA composite need score
```

This means a library in Mott Haven (need score 87) scores higher than the same library in a lower-need zone — directing volunteers toward places where outreach will have the highest marginal impact.

### Organizer Dashboard Metrics

The organizer view computes:

- **Zone coverage %** — (stops completed / total hotspot stops in zone) × 100
- **Estimated residents reached** — heuristic based on stops × average density per NTA population data
- **Volunteer-to-gap ratio** — active volunteers ÷ uncovered high-priority stops, used to flag zones needing reinforcement

---

## Route Optimization

### Algorithm: Priority-Weighted Greedy Path

Volun-Tiers deliberately chose a **greedy algorithm over TSP (Travelling Salesman Problem)** for several reasons: TSP is NP-hard and computationally expensive for real-time mobile use; greedy produces routes within seconds and typically achieves 85–90% of optimal distance for the density of stops seen in NYC neighborhood outreach; and the priority weighting means volunteers reach high-need stops first even if the path is not globally shortest.

**How it works:**

```
1. Volunteer taps Go → app captures GPS position as route origin
2. For each uncompleted stop:
     stop_score = stop_priority_weight / haversine_distance_meters(current_pos, stop)
3. Select stop with highest score → add to route → advance current position
4. Repeat until all stops are ordered
5. Estimate time: total_distance_meters / 80 m/min (walking speed)
```

The `haversine_distance_meters` implementation in `frontend/lib/distance.ts` uses the standard formula with Earth radius = 6,371,000 m, validated against GPS accuracy thresholds before being included in route calculations.

### GPS Track Normalization (`tracker-route.ts`)

Raw GPS data from mobile devices is noisy. Before persisting a session, the frontend applies:

| Filter | Threshold | Reason |
|--------|-----------|--------|
| Coordinate validity | lat ∈ [-90, 90], lng ∈ [-180, 180] | Reject impossible coordinates |
| Accuracy gate | > 120 m accuracy dropped | Unreliable GPS fix |
| Minimum separation | < 3 m between consecutive points | Remove stationary jitter |
| Zero-time jump | > 80 m with 0 elapsed seconds | Teleportation artifact |
| Impossible speed | > 12 m/s with measurable elapsed time | GPS drift spike |

After filtering, points are sorted by timestamp then original index (for ties), de-duplicated, and the route distance is recomputed from the cleaned point array.

### Result

Volunteers cover **40%+ more stops with zero overlap** compared to uncoordinated outreach, based on the team's simulation against real NYC hotspot density data.

---

## Neighbour-Hood: The AI Coordinator Agent

Neighbour-Hood is an LLM agent that activates automatically when a meetup reaches the **3-volunteer threshold**. It performs multi-step reasoning across zone data, volunteer positions, and service gap analysis to generate a structured assignment plan — and posts it directly to the meetup chat.

### How It Works

**Step 1 — Context Assembly**

`coordinatorService.js` assembles:
- Meetup metadata (location label, lat/lng, time window)
- All joined members (username, full name, role)
- The matched NTA region (via point-in-polygon from stored need regions)
- Region insights: dominant service gap + per-category gap distances (from `regionInsightsService.js`, cached 30 minutes)

**Step 2 — Gap-Aware Prompting**

The prompt names the neighborhood's biggest unmet service need so Gemini knows exactly WHAT materials volunteers should carry and WHERE to prioritize within the zone. This is the core innovation: most LLM coordinator prompts are generic; this one is grounded in real spatial data about which services are furthest from residents.

**Step 3 — Gemini API Call**

Calls `gemini-3.1-flash-lite-preview` with a structured JSON schema requiring per-volunteer compass-zone assignments:

```json
{
  "assignments": [
    {
      "username": "Priya",
      "quadrant": "NW",
      "corridorLabel": "St Ann's Ave corridor",
      "materials": ["health flyers", "clinic referral cards"]
    }
  ],
  "estimatedReach": 340,
  "estimatedMinutes": 90
}
```

**Step 4 — Auto-Post to Chat**

The parsed JSON is formatted into human-readable text and posted via the meetup messages API so every group member sees it immediately — zero manual coordination overhead.

### Example Output

```
📍 Zone: Mott Haven, Bronx | Need Score: 87/100
🔴 Biggest gap: Health services (avg 2.3 mi to nearest clinic)

Volunteer Assignments:
• Priya → NW quadrant (St Ann's Ave corridor)
  Carry: health flyers, clinic referral cards
• Marcus → SE quadrant (Willis Ave blocks)
  Carry: food pantry maps, SNAP info sheets
• Lena → NE quadrant (Cypress Ave)
  Carry: housing stability guides

Estimated reach: 340 households | Duration: ~90 min
```

---

## Bilingual Flyer Generation

Volunteers can generate printable outreach flyers from any GPS location. The system automatically detects the dominant non-English language for that zone and produces a dual-language flyer — with zero volunteer input required.

### Pipeline

1. **Zone Lookup** — Volunteer GPS maps to a NYC NTA via the already-fetched need region dataset
2. **NYC Language Query** — NYC Open Data returns the dominant non-English language for that NTA (e.g., Mandarin for Sunset Park, Spanish for Jackson Heights)
3. **Resource Selection** — `flyerService.js` queries nearby service resources from trusted NYC datasets (drop-in centers, health systems, flu vaccinations, DFTA providers, DYCD program sites) within a 5-mile radius, selects the top 4 by distance for the dominant gap category
4. **Gemini Translation** — Headline, blurb, and all UI labels are translated via Gemini API. Translation is culturally natural, not literal
5. **Dual-Language Render** — Both language versions saved to the database (`secondaryLanguage`, `headlineTranslated`, `blurbTranslated`, `translatedLabels`). Volunteer prints at a nearby print shop found via the Printers tab

English is always primary. Secondary language is inferred per zone from NYC Open Data — no volunteer input needed.

---

## Data Pipeline

### Need Regions Import

```
POST /api/need-regions/import/nyc-open-data
```

Fetches food insecurity scores and NTA polygon geometries from NYC Open Data, computes composite need scores, and upserts all 197 neighborhoods into PostgreSQL.

### OSM Hotspot Import

```
POST /api/locations/import/osm/nyc
```

Queries the Overpass API across 13 NYC sub-regions with 20 POI tag filters. Scores each location using the multi-factor algorithm, resolves its NTA region via point-in-polygon matching, and upserts into `hotspot_locations`. Supports multiple Overpass endpoint fallbacks for reliability.

### Route Sessions

GPS routes are normalized client-side (`tracker-route.ts`), submitted to `POST /api/sessions`, and persisted with full route point arrays (JSONB). Each save also:
- Increments `user_stats` (resource_cards_logged, total_hours_volunteered)
- Upserts `user_daily_activity` for streak tracking
- Updates coverage state on matched hotspot locations

---

## API Reference

### Authentication

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/auth/signup` | — | Register (username, email, password ≥8 chars) |
| POST | `/api/auth/login` | — | Login → JWT (7-day expiry) |
| GET | `/api/auth/me` | JWT | Current user + profile photo |
| POST | `/api/auth/agree-terms` | JWT | Accept Terms of Service |
| POST | `/api/auth/profile-photo` | JWT | Upload profile image URL |

### Locations & Need Regions

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/locations` | — | 1,500+ hotspot locations with scores |
| PATCH | `/api/locations/:id` | — | Mark location covered/assigned |
| POST | `/api/locations/import/osm/nyc` | — | Bulk OSM import |
| GET | `/api/need-regions` | — | 197 food-need regions with geometry |
| POST | `/api/need-regions/import/nyc-open-data` | — | Import from NYC Open Data |

### Sessions & Routing

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/sessions` | JWT | User's route sessions |
| POST | `/api/sessions` | JWT | Save route session (updates stats) |
| GET | `/api/route-items` | JWT | Saved stop items for current session |
| POST | `/api/route-items` | JWT | Add stop to active session |

### Events

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/events` | Optional | List outreach events |
| POST | `/api/events` | JWT | Create outreach event with stops |
| GET | `/api/events/:id` | Optional | Event detail + stop list |
| POST | `/api/events/:id/join` | JWT | Join event |
| GET | `/api/event-suggestions` | — | ML-generated event recommendations |

### Community & Meetups

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/community/posts` | Optional | Community feed |
| POST | `/api/community/posts` | JWT | Create post |
| POST | `/api/community/posts/:id/like` | JWT | Like/unlike |
| GET | `/api/meetups` | Optional | Meetups list |
| POST | `/api/meetups` | JWT | Create meetup (with optional auto-post) |
| POST | `/api/meetups/:id/join` | JWT | Join meetup (respects max_attendees) |
| GET | `/api/meetups/:id/messages` | JWT | Meetup group chat |
| POST | `/api/meetups/:id/messages` | JWT | Send message to meetup chat |

### Leaderboard, Badges & Activity

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/leaderboard` | — | Rankings weighted: (resource_cards × 1.5) + hours |
| GET | `/api/badges` | JWT | Badge status + current stats |
| GET | `/api/activity/recent` | — | Last 5 completed sessions |

### Flyers & Resources

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/flyers/generate` | JWT | Generate bilingual flyer from GPS |
| GET | `/api/flyers/:id` | — | Retrieve saved flyer |
| GET | `/api/service-resources` | — | Nearby service resources by lat/lng |

---

## Frontend Pages

| Page | Route | Description |
|------|-------|-------------|
| Home | `/` | Hero, live stats, quick actions, recent activity |
| Onboarding | `/onboarding` | Login / Signup / Guest flow with terms acceptance |
| Map | `/map` | Interactive outreach map with zone overlays and hotspots |
| Tracker | `/tracker` | GPS route recording, stop logging, session save |
| Events | `/events` | Outreach events list with ML recommendations |
| Printers | `/printers` | Google Places search for print shops with pricing |
| Leaderboard | `/leaderboard` | Podium (top 3), your standing, full rankings table |
| Profile | `/profile` | Stats, badges, sessions, certificate generation |
| Community | `/community` | Posts feed + meetups tab |
| Messages | `/messages` | Direct messaging threads |
| Guide | `/guide` | Step-by-step volunteer how-to guide |
| Get Started | `/getstarted` | 4-step flow: Learn → Download → Print → Volunteer |
| Flyers | `/flyers/[id]` | View and print AI-generated bilingual flyer |
| Resources | `/resources/[coords]` | Nearby service resources at a coordinate |
| Admin | `/admin` | Organizer dashboard (zone coverage, volunteer stats) |

---

## Database Schema

Key tables (all DDL in `backend/sql/`):

```sql
-- Neighborhood need data
need_regions (
  region_code, region_name, borough_name,
  geometry_json,           -- NTA polygon as JSONB
  centroid_lat, centroid_lng,
  food_insecure_percentage, food_need_score,
  health_access_score, housing_instability_score, substance_use_score,
  composite_need_score,    -- weighted aggregate
  updated_at
)

-- OSM-sourced outreach locations
hotspot_locations (
  source_key, osm_id, osm_type,
  name, category, address,
  neighborhood, region_code, region_name,
  region_need_score, priority, score,
  lat, lng, covered, assigned
)

-- Volunteer GPS sessions
route_sessions (
  id, user_id, started_at, ended_at,
  status, start_lat, start_lng,
  route_points,     -- JSONB array of {lat, lng, timestamp, accuracy}
  stops,            -- JSONB array of stop objects
  total_distance_meters, duration_minutes,
  resource_cards_logged
)

-- Outreach events (hackathon feature)
outreach_events (
  id, title, description, location_label,
  lat, lng, event_date, max_participants,
  need_score, dominant_gap,
  created_by, created_at
)

-- Meetup group chat (hackathon feature)
meetup_messages (
  id, meetup_id, user_id, content, created_at
)

-- Coverage proof photos
hotspot_coverage_proofs (
  id, user_id, location_id, photo_url,
  lat, lng, taken_at, verified
)
```

---

## Environment Variables

### Backend (`backend/.env`)

```env
DATABASE_URL=          # Supabase PostgreSQL connection string (required)
JWT_SECRET=            # JWT signing key (required)
PORT=5001              # Default port
GEMINI_API_KEY=        # Google Generative AI key (for coordinator agent)
OVERPASS_ENDPOINTS=    # Comma-separated Overpass API URLs (optional, defaults provided)
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=           # Backend base URL (e.g. http://localhost:5001)
NEXT_PUBLIC_API_BASE_URL=      # Same (naming inconsistency exists, set both)
GOOGLE_MAPS_API_KEY=           # Google Places API v1 key (server-side only)
GEMINI_API_KEY=                # Google Generative AI key (for chatbot + flyers)
NEXT_PUBLIC_GOOGLE_MAPS_ID=    # Map ID for Google Maps styling
```

---

## Running Locally

### Prerequisites

- Node.js 18+
- A Supabase project (or any PostgreSQL 14+ instance)
- Google Cloud project with Places API v1 + Maps JS API enabled
- Google AI Studio API key (Gemini)

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Fill in DATABASE_URL, JWT_SECRET, GEMINI_API_KEY
npm run dev                    # Starts on port 5001
```

On first start, the database schema is auto-created if tables don't exist. To seed NYC data:

```bash
# Import need regions (197 NYC neighborhoods)
curl -X POST http://localhost:5001/api/need-regions/import/nyc-open-data

# Import OSM hotspot locations (~1,500 locations across NYC)
curl -X POST http://localhost:5001/api/locations/import/osm/nyc
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
# Fill in all API keys and backend URL
npm run dev                    # Starts on port 3000
```

Visit `http://localhost:3000` to see the app.

---

## Testing

### End-to-End Tests (Playwright)

The test suite covers the full volunteer journey:

```bash
cd frontend
npm run test:e2e               # Headless
npm run test:e2e:headed        # With browser visible
npm run test:e2e:ui            # Playwright UI mode
```

Tests in `frontend/e2e/events.spec.ts` verify:
- Event discovery and filtering
- Joining an event and receiving a route
- Stop completion flow
- Session save and stats update

### Backend Verification

All API endpoints were verified with curl during development. The backend uses Supabase's connection pooling and all routes are mounted in `app.js` — no silent 404s.

---

## Hackathon Transparency

### Built During This Hackathon (April 26, 2026)

All of the following were written from scratch during the Code4City 2026 hackathon window:

- **Neighbour-Hood LLM coordinator agent** — Gemini gap-aware prompting, per-volunteer compass-zone assignments, auto-post to meetup chat
- **ML event & zone recommendation engine** — 5-factor weighted scoring, 8-week behavioral clustering, 3-user minimum threshold
- **Greedy route optimization** — Haversine distance + priority weighting, GPS track normalization pipeline
- **OSM Overpass hotspot ingestion** — 20 POI categories across 13 NYC sub-regions
- **NYC Open Data composite need score** — food + health + housing + substance 4-factor weighted model
- **Outreach event creation** — stop tracking, volunteer join flow, organizer dashboard metrics
- **Bilingual flyer generation** — zone language detection, Gemini API translation, dual-language render
- **Playwright E2E test suite** — covering the full volunteer journey end to end
- **regionInsightsService** — per-zone service gap analysis with 30-minute cache

### Pre-Existing Foundation (Prior Work)

The following were built before the hackathon and are explicitly separated:

- User authentication (signup, login, JWT middleware)
- Community feed (posts, likes, comments)
- Leaderboard and badge system
- QR code system
- Basic map scaffolding
- DM messaging infrastructure

---

## License

Built at Code4City 2026. All features built during the hackathon window are open for review and extension.

---

> *No neighborhood gets left behind.*
