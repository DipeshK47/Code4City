# Product Requirements Document

## Product

Lemontree Volunteer Hub

## Product summary

Lemontree Volunteer Hub is a volunteer operations platform for flyer-based outreach around food access. The product helps volunteers learn the outreach process, identify high-impact locations, print materials, and record work completed in the field.

## Problem

Food resources may exist in a community, but awareness is fragmented. Lemontree’s outreach model depends on volunteers distributing flyers in the right places, with the right information, and with enough operational support to make the work repeatable. Today that workflow is partially manual and hard to coordinate.

## Goal

Deliver a demo-ready MVP that proves Lemontree can:

- onboard new volunteers quickly,
- guide them to high-need outreach zones,
- help them print and distribute flyers,
- track field activity in a simple, visible way.

## Primary users

### Volunteer

- Wants a fast path from signup to action.
- Needs to know where to go, what to do, and how to track progress.

### Organizer / team lead

- Wants visibility into where volunteers should go and what outreach has been completed.

### Community member discovering resources

- Indirect beneficiary of more effective flyer distribution.

## Core use cases

1. A new volunteer visits the site, reads the guide, creates an account, and accepts terms.
2. A returning volunteer opens the map and finds recommended locations in higher-need regions.
3. A volunteer finds a nearby printer and gets flyers printed.
4. A volunteer starts a route session, walks a route, adds stop markers, and saves the session.
5. An organizer reviews hotspot coverage and adjusts outreach priorities.

## MVP scope

### In scope

- Volunteer onboarding
- Login and signup
- Mission and terms acceptance
- Interactive outreach map
- Need-region overlays and hotspot prioritization
- Printer finder
- Route tracking with session save
- Basic leaderboard/profile shells for demo narrative

### Out of scope for immediate demo

- Full production auth hardening
- Real organizer dashboards
- Full analytics
- Multilingual flyer generation workflow
- Mobile app
- Notification systems

## Current implementation status

### Implemented or partially implemented

- Home page and app shell navigation
- Onboarding UI flow
- Volunteer guide page
- Outreach map dashboard
- Printer discovery UI using Google Places-backed routes
- Route tracker UI and local/backend session save path
- Backend route/controller structure for auth, locations, need regions, and sessions

### Known blockers

- Backend auth routes are defined but not mounted in `backend/src/app.js`.
- Backend session routes are defined but not mounted in `backend/src/app.js`.
- Frontend route naming is inconsistent around `guide` vs `getstarted`.
- Frontend environment variable naming is inconsistent around API base URL configuration.
- Auth depends on database configuration that may not be present in a fresh demo environment.

## Success criteria for demo

- A judge can understand the product in under 60 seconds.
- The volunteer path works without code changes during the demo.
- The map loads meaningful hotspot and need-region data.
- The printer workflow returns actionable nearby results.
- The tracker can record and save at least one session end to end.

## Demo script recommendation

1. Show home page value proposition.
2. Click into the volunteer guide / get-started flow.
3. Show the map prioritizing higher-need outreach locations.
4. Show printer discovery near a selected area.
5. Start and stop a tracker session and show saved output.

## Risks

### Technical

- Auth cannot work if backend routes or database config are incomplete.
- Tracker save cannot work if session routes are not mounted.
- Printer search depends on a valid Google API key.
- Map imports may fail if upstream services are unavailable or slow.

### Demo

- Route mismatches can break CTA flows in front of judges.
- Fresh environments may fail because env vars are incomplete.
- Encoding artifacts reduce polish and trust.

## Immediate task backlog

Ordered for immediate demo readiness:

1. `Critical / Immediate`: Mount auth and session routes in `backend/src/app.js`.
2. `Critical / Immediate`: Resolve `/guide` vs `/getstarted` route mismatch.
3. `Critical / Immediate`: Configure backend env vars and validate signup/login/terms.
4. `High / Immediate`: Consolidate frontend API base env naming.
5. `High / Immediate`: Validate map load/import APIs in a clean local run.
6. `High / Immediate`: Validate printer search with working Google API credentials.
7. `High / Immediate`: Validate tracker save and retrieval path.
8. `Medium / Near-term`: Seed demo-friendly data and one demo account.
9. `Medium / Near-term`: Clean text encoding artifacts across the UI.
10. `Medium / Near-term`: Create a short spoken demo runbook and fallback plan.

## Non-goals for the hackathon demo

- Perfect production architecture
- Complete long-term analytics
- Full admin tooling
- Fully automated deployment pipeline
