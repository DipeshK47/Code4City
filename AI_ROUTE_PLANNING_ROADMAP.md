# AI Route Planning Assistant Roadmap

## Goal

Add an AI-assisted route planner that suggests the best stop order for a volunteer based on:

- time of day
- hotspot category / likely foot traffic
- past coverage freshness
- neighborhood need
- volunteer constraints like max walking time, max stops, printer requirement, and preferred neighborhoods

The AI should improve route quality, but hard constraints and final persistence should stay deterministic in backend code.

## Existing Code To Build On

- Backend route item storage: `backend/src/services/routeItemService.js`
- Backend route item persistence: `backend/src/data/routeItemRepository.js`
- Existing event route optimization: `backend/src/services/eventService.js`
- Session persistence: `backend/src/services/sessionService.js`
- Map ranking UI: `frontend/components/map/OutreachMapDashboard.tsx`
- Route tracker UI: `frontend/components/tracker/TrackerSessionExperience.tsx`
- Schema: `backend/sql/supabase_schema.sql`
- Saved route item SQL: `backend/sql/saved_route_items.sql`

## Product Shape

The assistant should do 3 things:

1. Accept a volunteer’s current route candidates and constraints.
2. Return an ordered stop list plus reasoning for why the route is ordered that way.
3. Fall back to deterministic routing if the model fails, times out, or returns invalid output.

## Recommended Architecture

Use a hybrid design:

- Rule engine for safety and constraints
- AI model for ranking tradeoffs and route explanation
- Existing deterministic nearest-neighbor logic as fallback

Do not let the model directly write to the database.

## Phase 1: Define Inputs And Outputs

### New API contract

Create a dedicated backend endpoint:

- `POST /api/route-planner/plan`

Request payload:

```json
{
  "userLat": 40.7128,
  "userLng": -74.0060,
  "timeOfDay": "evening",
  "constraints": {
    "maxStops": 8,
    "maxMinutes": 90,
    "avoidCovered": true,
    "includePrinterStop": false,
    "preferredCategories": ["Library", "Laundry"],
    "preferredRegionCodes": ["BK-101", "BK-102"]
  },
  "candidateStops": [
    {
      "id": "hotspot:120",
      "hotspotId": 120,
      "name": "Sunrise Laundry",
      "category": "Laundry",
      "lat": 40.7,
      "lng": -74.0,
      "covered": false,
      "regionCode": "BK-101",
      "regionNeedScore": 8.7,
      "lastProofAt": "2026-04-25T10:11:12.000Z",
      "distanceMiles": 0.5
    }
  ]
}
```

Response payload:

```json
{
  "strategy": "ai_hybrid",
  "estimatedDurationMinutes": 72,
  "estimatedDistanceMeters": 4100,
  "orderedStops": [
    {
      "id": "hotspot:120",
      "sequence": 1,
      "reason": "High need zone, uncovered, near current position, strong evening foot traffic."
    }
  ],
  "explanations": [
    "Started with two uncovered laundry and library stops within 0.7 miles.",
    "Deferred low-need covered locations to the end."
  ],
  "fallbackUsed": false
}
```

## Phase 2: Add Data Needed For Better Decisions

The current schema has enough basics for a first version, but not enough for a good AI planner.

### Add new columns or tables

Recommended new SQL file:

- `backend/sql/ai_route_planning.sql`

Add:

1. `last_proof_at` on `hotspot_locations`
2. `coverage_count` on `hotspot_locations`
3. `foot_traffic_profile` on `hotspot_locations`
4. `ai_route_plan_logs` table for observability

Example DDL:

```sql
ALTER TABLE hotspot_locations
  ADD COLUMN IF NOT EXISTS last_proof_at TIMESTAMPTZ;

ALTER TABLE hotspot_locations
  ADD COLUMN IF NOT EXISTS coverage_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE hotspot_locations
  ADD COLUMN IF NOT EXISTS foot_traffic_profile JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS ai_route_plan_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  strategy TEXT NOT NULL,
  request_json JSONB NOT NULL,
  response_json JSONB,
  fallback_used BOOLEAN NOT NULL DEFAULT FALSE,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Backfill logic

Update proof submission flow in `backend/src/services/hotspotProofService.js` to also update:

- `hotspot_locations.last_proof_at = NOW()`
- `hotspot_locations.coverage_count = coverage_count + 1`

### Foot traffic seed

For MVP, start with static heuristics by category:

- `Laundry`: good morning and evening
- `Library`: good afternoon
- `Coffee Shop`: good morning
- `Marketplace`: good midday and weekend

Store these as JSON so later you can replace them with measured traffic.

## Phase 3: Backend Planning Pipeline

### New files

Create:

- `backend/src/routes/routePlannerRoutes.js`
- `backend/src/controllers/routePlannerController.js`
- `backend/src/services/routePlannerService.js`
- `backend/src/services/aiRoutePlannerService.js`

Mount route:

- `backend/src/app.js`

### Internal backend pipeline

Step 1. Validate request.

Step 2. Enrich each candidate stop with:

- distance from volunteer
- last proof freshness
- need score
- category suitability
- heuristic foot traffic score for current time window

Step 3. Apply hard filters:

- remove invalid coordinates
- drop already covered stops if `avoidCovered = true`
- enforce `maxStops`
- enforce radius cap if you add one

Step 4. Build AI prompt input with structured JSON only.

Step 5. Ask model for:

- ordered stop IDs
- short reason per stop
- short route summary

Step 6. Validate model output:

- all IDs must exist in candidate list
- no duplicates
- no stop count above request limit

Step 7. Compute estimated route distance using deterministic code.

Step 8. If validation fails, use deterministic fallback from `eventService.js`-style nearest-neighbor scoring.

Step 9. Log request and response to `ai_route_plan_logs`.

## Phase 4: Model Integration

### Recommended provider pattern

Do not couple this directly to the frontend `app/api/chat` route.

Instead, add backend-only provider config:

- `AI_PROVIDER=google`
- `AI_ROUTE_MODEL=gemini-2.5-flash` or current preferred fast structured-output model
- `GOOGLE_API_KEY=...`

### Prompt design

Use JSON-only output.

System instructions should say:

- optimize for outreach impact first
- obey max stops and time budget
- prefer uncovered high-need locations
- use time-of-day and category relevance
- minimize zig-zag walking
- never invent stops

Expected model output:

```json
{
  "orderedStopIds": ["hotspot:120", "hotspot:98", "hotspot:56"],
  "reasonsByStopId": {
    "hotspot:120": "High need and closest uncovered laundry stop for evening outreach."
  },
  "summary": "This route starts with the nearest high-need evening-friendly stops and avoids backtracking."
}
```

## Phase 5: Frontend Integration

### Map page integration

Primary integration point:

- `frontend/components/map/OutreachMapDashboard.tsx`

Add:

- `Plan My Route` button
- constraints panel
- AI explanation card
- ability to accept suggested ordering into saved route items

### Tracker integration

Show route rationale in:

- `frontend/components/tracker/TrackerSessionExperience.tsx`

Add:

- route summary
- ordered stop chips
- fallback indicator if AI was unavailable

### Frontend API client

Create:

- `frontend/lib/route-planner-api.ts`

## Phase 6: Deterministic Fallback

Reuse and adapt logic from:

- `backend/src/services/eventService.js`

Fallback score should combine:

- distance
- uncovered bonus
- region need score
- category-time fit
- stale coverage bonus

This fallback must always be available so route planning still works when:

- the AI provider is down
- structured output is malformed
- latency is too high

## Phase 7: Evaluation

### Offline metrics

Measure on sample routes:

- total estimated walking distance
- average need score per stop
- uncovered-stop ratio
- stale-coverage-stop ratio
- route completion rate later in real sessions

### Human review checklist

- Did the plan avoid obvious backtracking?
- Did the first 3 stops make sense for the time window?
- Did the route over-prioritize distant hotspots?
- Did the explanation match the actual ordering?

## Phase 8: Observability

Log:

- model latency
- fallback rate
- invalid-output rate
- average planned stops
- plan acceptance rate in UI

Add simple admin visibility later through:

- `frontend/app/admin/page.tsx`
- `backend/src/controllers/adminController.js`

## Implementation Checklist

### Backend

- Add SQL migration file for AI route planning support.
- Update `hotspotProofService.js` to maintain freshness counters.
- Add route planner route/controller/service files.
- Add provider wrapper for AI calls.
- Add response validation and fallback logic.
- Add structured logging table writes.

### Frontend

- Add API client for route planning.
- Add route constraints UI in map dashboard.
- Add AI route summary and accept/apply action.
- Add fallback messaging in tracker/map views.

### Testing

- Unit test prompt input builder.
- Unit test model output validator.
- Unit test deterministic fallback order.
- Integration test `POST /api/route-planner/plan`.
- Frontend smoke test for apply-plan flow.

## Recommended Command Sequence

### 1. Install backend AI SDK

```bash
cd /Users/veedantbrahmbhatt/hackathon/Code4City/backend
npm install @google/generative-ai
```

### 2. Create migration file

```bash
touch /Users/veedantbrahmbhatt/hackathon/Code4City/backend/sql/ai_route_planning.sql
```

### 3. Apply SQL in Supabase

Use Supabase SQL Editor or `psql`:

```bash
psql "$DATABASE_URL" -f /Users/veedantbrahmbhatt/hackathon/Code4City/backend/sql/ai_route_planning.sql
```

### 4. Add backend files

```bash
touch /Users/veedantbrahmbhatt/hackathon/Code4City/backend/src/routes/routePlannerRoutes.js
touch /Users/veedantbrahmbhatt/hackathon/Code4City/backend/src/controllers/routePlannerController.js
touch /Users/veedantbrahmbhatt/hackathon/Code4City/backend/src/services/routePlannerService.js
touch /Users/veedantbrahmbhatt/hackathon/Code4City/backend/src/services/aiRoutePlannerService.js
```

### 5. Add frontend API client

```bash
touch /Users/veedantbrahmbhatt/hackathon/Code4City/frontend/lib/route-planner-api.ts
```

### 6. Run backend locally

```bash
cd /Users/veedantbrahmbhatt/hackathon/Code4City/backend
npm run dev
```

### 7. Run frontend locally

```bash
cd /Users/veedantbrahmbhatt/hackathon/Code4City/frontend
npm run dev
```

### 8. Test endpoint manually

```bash
curl -X POST http://localhost:5001/api/route-planner/plan \
  -H "Content-Type: application/json" \
  -d '{
    "userLat": 40.7128,
    "userLng": -74.0060,
    "timeOfDay": "evening",
    "constraints": {
      "maxStops": 5,
      "maxMinutes": 60,
      "avoidCovered": true
    },
    "candidateStops": []
  }'
```

### 9. Run tests

```bash
cd /Users/veedantbrahmbhatt/hackathon/Code4City/backend
npm test
```

If you add a real test runner later:

```bash
npx jest routePlanner
```

## MVP Order

Implement in this exact order:

1. Add schema support.
2. Backfill proof freshness fields.
3. Build deterministic planner service.
4. Add AI provider and structured output validator.
5. Add backend endpoint.
6. Add frontend controls and explanation panel.
7. Add logs and fallback metrics.

## Risks

- AI may return persuasive but invalid stop orders.
- Time-of-day quality will be weak if foot traffic is only heuristic.
- Too much AI freedom will reduce trust if users see strange routes.

## Recommendation

Ship V1 as hybrid, not AI-only. The model should rank and explain. The backend should still enforce constraints and compute final geometry.
