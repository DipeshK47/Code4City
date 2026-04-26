# Lemontree Volunteer Hub

Lemontree Volunteer Hub is a hackathon MVP for coordinating flyer-based outreach that helps neighbors find free food resources. The product combines volunteer onboarding, hotspot discovery, route tracking, nearby printing support, and food-need-aware map prioritization.

This README is anchored to the product definition in [PRD.md](/d:/sharvin1/Hackathons/Track-A---Team-2/PRD.md). Where the current build differs from the intended product, the gaps are called out below so the team can focus on demo readiness.

## What the product does

- Helps volunteers find high-priority outreach locations on a map.
- Guides new volunteers through onboarding and the flyering workflow.
- Tracks volunteer walking sessions and stop points.
- Helps volunteers find nearby print shops for flyer production.
- Surfaces higher-need regions so outreach effort can be directed intentionally.

## Current implementation snapshot

### Frontend

- Framework: Next.js App Router with React 19 and TypeScript.
- Main pages present: home, map, tracker, printers, leaderboard, profile, onboarding, and guide.
- API proxy routes present for printer search and Google Places autocomplete/details.

### Backend

- Framework: Express.
- Data/services present for hotspot import, need-region import, auth, and session persistence.
- Session storage currently includes a JSON-backed store for tracker sessions.
- Auth expects a PostgreSQL-compatible database connection.

## Repository structure

```text
backend/
  src/
    app.js
    server.js
    controllers/
    routes/
    services/
    data/
    db/
frontend/
  app/
  components/
  context/
  lib/
README.md
PRD.md
```

## Local setup

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Default URL: `http://localhost:3000`

### Backend

```bash
cd backend
npm install
npm run dev
```

Default URL: `http://localhost:5001`

## Environment notes

### Backend

See [`backend/.env.example`](/d:/sharvin1/Hackathons/Track-A---Team-2/backend/.env.example).

Required for auth:

- `PORT`
- `DATABASE_URL`
- `JWT_SECRET`

### Frontend

The frontend currently references more than one API base env name in code:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `GOOGLE_MAPS_API_KEY`

For demo stability, these should be consolidated.

For QR code generation in Step 2:

- `NEXT_PUBLIC_APP_URL` should be the public frontend URL, for example `https://your-app.vercel.app`
- `NEXT_PUBLIC_API_BASE_URL` should be the public backend/API URL used by the QR forwarding route

## Demo path

The intended demo path from the current product direction is:

1. Land on the home page and enter the volunteer flow.
2. Read the guide / get-started content.
3. Use the map to show high-need outreach targets.
4. Use the printer finder to show operational support for volunteers.
5. Start and stop a tracker session to demonstrate route logging.

## Known product and engineering gaps

- Auth routes exist in the backend but are not currently mounted in [`backend/src/app.js`](/d:/sharvin1/Hackathons/Track-A---Team-2/backend/src/app.js).
- Session routes exist in the backend but are not currently mounted in [`backend/src/app.js`](/d:/sharvin1/Hackathons/Track-A---Team-2/backend/src/app.js).
- The frontend references `/getstarted`, while the repo currently contains [`frontend/app/guide/page.tsx`](/d:/sharvin1/Hackathons/Track-A---Team-2/frontend/app/guide/page.tsx) rather than a `/getstarted` route.
- The frontend mixes `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_API_BASE_URL`.
- The tracker references backend session APIs that may not respond until session routes are wired.
- The onboarding/auth flow depends on backend auth plus a configured database.

## Immediate demo task list

Ordered by severity and urgency for an immediate working demo:

1. `Critical`: Mount `authRoutes` and `sessionRoutes` in [`backend/src/app.js`](/d:/sharvin1/Hackathons/Track-A---Team-2/backend/src/app.js).
2. `Critical`: Fix the get-started route mismatch by either creating `/getstarted` or changing all links back to `/guide`.
3. `Critical`: Verify the auth flow end to end with a real `DATABASE_URL` and `JWT_SECRET`.
4. `High`: Standardize the frontend API base environment variable naming and update all callers.
5. `High`: Smoke-test the tracker create/save path against `/api/sessions`.
6. `High`: Smoke-test the map import and load flow against `/api/locations` and `/api/need-regions`.
7. `High`: Confirm the printer finder works with a valid `GOOGLE_MAPS_API_KEY`.
8. `Medium`: Replace broken text encoding artifacts across UI copy before demo.
9. `Medium`: Add one scripted demo account and a seeded dataset for deterministic presentations.
10. `Medium`: Add a one-page demo runbook with exact clicks and fallback screens.

## Product definition

For scope, goals, users, current status, and demo priorities, see [PRD.md](/d:/sharvin1/Hackathons/Track-A---Team-2/PRD.md).
