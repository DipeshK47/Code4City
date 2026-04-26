# UrbanReach Implementation Context

## Project Direction

UrbanReach is being refocused around three core capabilities:

- Multi-event organization for city and nonprofit outreach campaigns.
- Recommendation systems for matching volunteers, events, and underserved zones.
- Path optimization for efficient volunteer outreach routes.

The product should help organizations plan multiple outreach events, recommend the best events or zones to prioritize, guide volunteers through optimized outreach stops, and update coverage/impact after sessions are completed.

## Existing Stack

Frontend:

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Custom UI components
- Leaflet / React Leaflet and Mapbox GL dependencies

Backend:

- Express
- PostgreSQL via `pg`
- JWT auth structure
- Existing routes for sessions, locations, need regions, community, meetups, messages, leaderboard, badges, QR, and admin

Repository:

- New GitHub target: `https://github.com/DipeshK47/Code4City`
- Current local folder was checked on 2026-04-26 and is not initialized as a git repository.

Local runtime added during setup:

- `backend/.env.local` points to Supabase Postgres on port `5001` with a local JWT secret. Secret values are intentionally not documented here.
- `frontend/.env.local` points to backend at `http://localhost:5001`
- Previous local Docker container used during initial setup: `code4city-postgres`
- Supabase database initialization was smoke-tested successfully on 2026-04-26.

## Target Feature Set

### Multi-Event Organization

Events should support:

- title, description, category
- target zone
- organizer
- start/end time
- volunteer capacity
- status
- priority score
- outreach stops
- volunteer assignments

### Recommendation System

Volunteer event recommendations should consider:

- event priority
- zone need
- volunteer distance
- remaining volunteer capacity
- service category match

Organizer zone recommendations should consider:

- zone need
- low coverage
- time since last outreach
- service gaps
- upcoming event overlap

### Path Optimization

Optimized outreach routes should:

- start from volunteer latitude/longitude
- order uncompleted event stops
- prefer nearby and higher-priority stops
- return distance and duration estimates
- support completed stop filtering

## Initial Implementation Plan

1. Add backend database schema for events, event stops, and event assignments.
2. Add seed data so the demo works even before full NYC Open Data ingestion.
3. Add event APIs:
   - `GET /api/events`
   - `POST /api/events`
   - `GET /api/events/:id`
   - `PATCH /api/events/:id`
   - `POST /api/events/:id/join`
   - `POST /api/events/:id/stops/:stopId/complete`
   - `GET /api/events/recommended`
   - `GET /api/events/:id/optimized-route`
4. Add recommendation service.
5. Add route optimization service.
6. Build frontend event list/detail flow.
7. Connect map/tracker/dashboard after backend foundation is stable.

## Progress Log

### 2026-04-26

- Created this implementation context document.
- Inspected backend architecture and followed the existing route/controller/service pattern.
- Added PostgreSQL-backed UrbanReach tables inside backend DB initialization:
  - `outreach_zones`
  - `outreach_events`
  - `outreach_event_stops`
  - `outreach_event_assignments`
- Added demo seed data for three NYC outreach zones:
  - Sunset Park Outreach Zone
  - Mott Haven Service Access Zone
  - Jackson Heights Community Aid Zone
- Added demo seed data for three outreach events with route-ready stops.
- Added backend event API files:
  - `backend/src/routes/eventRoutes.js`
  - `backend/src/controllers/eventController.js`
  - `backend/src/services/eventService.js`
- Mounted event APIs in `backend/src/app.js` at `/api/events`.
- Implemented event recommendation scoring using:
  - zone need
  - event priority
  - volunteer proximity when provided
  - remaining capacity
  - category match
- Implemented zone recommendation scoring using:
  - zone need
  - low coverage
  - service gap
  - days since last outreach
  - upcoming event overlap penalty
- Implemented greedy path optimization for event stops using:
  - volunteer start location if provided
  - zone center fallback
  - distance to next stop
  - stop priority weight
- Added frontend event API client:
  - `frontend/lib/urbanreach-events-api.ts`
- Added same-origin frontend event proxy:
  - `frontend/app/api/events/[[...path]]/route.ts`
- Added frontend event pages:
  - `frontend/app/events/page.tsx`
  - `frontend/app/events/[id]/page.tsx`
- Added frontend event components:
  - `frontend/components/events/EventsPageClient.tsx`
  - `frontend/components/events/EventDetailClient.tsx`
- Added Events navigation to the sidebar and home quick actions.
- Improved the Events UI:
  - Added category/focus filtering on `/events`.
  - Added clearer event card hierarchy for match score, priority, capacity, estimated reach, and stop progress.
  - Added capacity and stop-completion progress bars.
  - Added zone coverage bars to organizer recommendations.
- Improved the Event Detail UI:
  - Completed stops now remain visible and show a `Done` state instead of disappearing from the optimized route list.
  - Route summary now uses prominent distance/time tiles.
  - Join controls now show open capacity and an `Event Full` state.
  - Zone intelligence now includes score bars for need and service gap.
- Updated the Playwright e2e test to assert completed stops remain visible with `Done`.

## Implemented API Surface

Event APIs:

- `GET /api/events`
- `POST /api/events`
- `GET /api/events/recommended`
- `GET /api/events/zones/recommended`
- `GET /api/events/:id`
- `PATCH /api/events/:id`
- `POST /api/events/:id/join`
- `POST /api/events/:id/stops/:stopId/complete`
- `GET /api/events/:id/optimized-route?lat=...&lng=...`

Frontend pages:

- `/events` shows event recommendations, event metrics, and organizer zone recommendations.
- `/events/[id]` shows event details, join action, optimized route summary, stop order, and stop completion.

## Verification

Completed checks:

- `curl http://localhost:5001/api/events`
- `curl http://localhost:5001/api/events/recommended`
- `curl http://localhost:5001/api/events/zones/recommended`
- `curl http://localhost:5001/api/events/1/optimized-route`
- `POST /api/events/:id/join`
- `POST /api/events/:id/stops/:stopId/complete`
- `curl -I http://localhost:3000/events`
- `curl -I http://localhost:3000/events/2`
- `curl http://localhost:3000/api/events/2/optimized-route?lat=40.6400&lng=-74.0100`
- `npm run lint`
- `npm run build`
- `npm run test:e2e -- --reporter=list`

Current validation result:

- Backend event endpoints return seeded data successfully.
- Frontend event routes compile and return `200 OK`.
- ESLint reports only pre-existing warnings outside the new event files.
- Production build passes.
- Playwright e2e tests pass.

Manual testing note:

- A browser `ERR_CONNECTION_REFUSED` was observed when the UI called the backend directly at `localhost:5001` for route optimization.
- Fix: event UI calls now go through the same-origin Next API proxy at `/api/events/...`.
- The proxy forwards requests server-side to the backend configured by `BACKEND_API_BASE_URL`, `NEXT_PUBLIC_API_BASE_URL`, or `http://127.0.0.1:5001`.
- This makes event recommendations, joins, stop completion, and optimized routes work when the frontend is opened through `localhost`, `127.0.0.1`, or a network host.

## E2E Testing

Playwright was added for end-to-end testing.

Files added:

- `frontend/playwright.config.ts`
- `frontend/e2e/events.spec.ts`

Scripts added to `frontend/package.json`:

- `npm run test:e2e`
- `npm run test:e2e:ui`
- `npm run test:e2e:headed`

The current e2e suite covers:

- `/events` rendering recommended events and organizer zone recommendations.
- Creating a unique outreach event through the backend API.
- Opening `/events/:id`.
- Joining the event.
- Confirming optimized stops are visible.
- Completing a stop.
- Confirming progress updates to 50%.

Run from `frontend/`:

```bash
npm run test:e2e
```

The Playwright config can reuse already-running frontend/backend servers. It can also start them automatically, but the backend still requires a working Postgres database such as the local Docker container `code4city-postgres`.

## AI Model Setup Status

There are two different kinds of "AI" in this project right now:

1. UrbanReach event intelligence:
   - Implemented in `backend/src/services/eventService.js`.
   - Uses deterministic scoring and optimization logic, not an external AI model.
   - Event recommendations use weighted scoring.
   - Zone recommendations use weighted scoring.
   - Route optimization uses a greedy distance-plus-priority algorithm.

2. Chat assistant:
   - Implemented in `frontend/app/api/chat/route.ts`.
   - Uses `@google/generative-ai`.
   - Configured model string: `gemini-3.1-flash-lite-preview`.
   - Requires `GEMINI_API_KEY`.

Local setup status:

- `frontend/.env.example` includes `GEMINI_API_KEY=`.
- `frontend/.env.local` does not currently set `GEMINI_API_KEY`.
- Therefore the chat assistant model is not configured locally yet.
- The recommendation and route optimization features do not need `GEMINI_API_KEY`.

## Next Implementation Steps

1. Add event creation UI for organizers.
2. Connect event recommendations to the main map as markers and zone overlays.
3. Connect completed event stops to tracker sessions.
4. Add dashboard analytics for active events, coverage, estimated reach, and remaining high-priority zones.
5. Replace demo seed data with NYC Open Data processing once datasets are selected.
