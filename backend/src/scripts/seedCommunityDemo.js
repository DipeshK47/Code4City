const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const bcrypt = require("bcrypt");
const { query, initDb, closePool } = require("../db");
const {
  seedDemoSessions,
  generateSuggestions,
} = require("../services/eventSuggestionService");
const {
  maybeAutoCoordinate,
} = require("../services/coordinatorService");

const DEFAULT_PASSWORD = process.env.DEMO_PASSWORD || "Volunteer2026!";

const DEMO_USERS = [
  { username: "maya_chen", fullName: "Maya Chen", email: "maya.chen@voluntiers.demo" },
  { username: "devon_walker", fullName: "Devon Walker", email: "devon.walker@voluntiers.demo" },
  { username: "priya_iyer", fullName: "Priya Iyer", email: "priya.iyer@voluntiers.demo" },
  { username: "ali_hassan", fullName: "Ali Hassan", email: "ali.hassan@voluntiers.demo" },
  { username: "rosa_martinez", fullName: "Rosa Martinez", email: "rosa.martinez@voluntiers.demo" },
];

function todayAt(hour, minute = 0, dayOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

const DEMO_MEETUPS = [
  {
    creatorIndex: 0,
    title: "Sunset Park outreach walk — flyer drop & fridge check",
    description:
      "Meeting at the library steps. We'll cover the laundromats and bodegas along 5th Ave with bilingual food-access flyers, then verify the community fridge stock at 4th & 39th. Great for first-timers.",
    locationLabel: "Sunset Park Library, Brooklyn",
    lat: 40.6452,
    lng: -74.0095,
    startHour: 19,
    endHour: 21,
    dayOffset: 0,
    maxAttendees: 8,
  },
  {
    creatorIndex: 1,
    title: "Crown Heights Sunday afternoon flyer push",
    description:
      "Three people have run solo routes here every Sunday for a month — let's do it together this time. Meeting at the library, fanning out to the laundry strip on Nostrand.",
    locationLabel: "Brooklyn Public Library — Eastern Parkway Branch",
    lat: 40.6722,
    lng: -73.9447,
    startHour: 20,
    endHour: 22,
    dayOffset: 0,
    maxAttendees: 6,
  },
  {
    creatorIndex: 2,
    title: "Washington Heights morning route — Spanish flyers",
    description:
      "Bilingual route along Broadway and Saint Nicholas. We have 200 Spanish-language flyers ready. Best for volunteers with conversational Spanish but anyone is welcome.",
    locationLabel: "Fort Washington Park entrance, Washington Heights",
    lat: 40.8390,
    lng: -73.9408,
    startHour: 10,
    endHour: 12,
    dayOffset: 1,
    maxAttendees: 10,
  },
  {
    creatorIndex: 3,
    title: "Bronx Library Center flyer + pantry tour",
    description:
      "Quick orientation, then a 90-minute walking route hitting Fordham Plaza, the Mott Haven pantry, and the laundromats on Grand Concourse. Bring a tote.",
    locationLabel: "Bronx Library Center, Fordham",
    lat: 40.8606,
    lng: -73.8966,
    startHour: 14,
    endHour: 16,
    dayOffset: 1,
    maxAttendees: 7,
  },
  {
    creatorIndex: 4,
    title: "Flushing afternoon shift — Mandarin & Korean flyers",
    description:
      "Meeting at Flushing Library. Two language tracks running in parallel. We'll regroup at Main St for fridge restock.",
    locationLabel: "Queens Public Library — Flushing Branch",
    lat: 40.7591,
    lng: -73.8298,
    startHour: 17,
    endHour: 19,
    dayOffset: 1,
    maxAttendees: 8,
  },
];

async function upsertUser(user) {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  const result = await query(
    `
      INSERT INTO users (username, email, password_hash, agreed_to_terms, full_name)
      VALUES ($1, $2, $3, TRUE, $4)
      ON CONFLICT (email) DO UPDATE
        SET full_name = EXCLUDED.full_name,
            agreed_to_terms = TRUE
      RETURNING id, username, email, full_name
    `,
    [user.username, user.email, passwordHash, user.fullName],
  );
  return result.rows[0];
}

async function wipeCommunity() {
  await query(`DELETE FROM meetup_messages`);
  await query(`DELETE FROM meetup_members`);
  await query(`DELETE FROM community_posts`);
  await query(`DELETE FROM meetups`);
  await query(`DELETE FROM suggested_events`);
  await query(`DELETE FROM route_sessions WHERE status = 'completed' AND distance_miles <= 5`);
}

async function createMeetupForUser(meetupSpec, creatorId) {
  const startTime = todayAt(meetupSpec.startHour, 0, meetupSpec.dayOffset);
  const endTime = todayAt(meetupSpec.endHour, 0, meetupSpec.dayOffset);
  const result = await query(
    `
      INSERT INTO meetups (
        created_by, title, description, location_label, lat, lng,
        start_time, end_time, status, max_attendees
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9)
      RETURNING id
    `,
    [
      creatorId,
      meetupSpec.title,
      meetupSpec.description,
      meetupSpec.locationLabel,
      meetupSpec.lat,
      meetupSpec.lng,
      startTime,
      endTime,
      meetupSpec.maxAttendees,
    ],
  );
  const meetupId = Number(result.rows[0].id);

  await query(
    `
      INSERT INTO meetup_members (meetup_id, user_id, role)
      VALUES ($1, $2, 'host')
      ON CONFLICT DO NOTHING
    `,
    [meetupId, creatorId],
  );

  return meetupId;
}

async function main() {
  await initDb();

  console.log("Wiping old community + meetup data…");
  await wipeCommunity();

  console.log("Upserting demo users…");
  const userRows = [];
  for (const user of DEMO_USERS) {
    const row = await upsertUser(user);
    userRows.push(row);
    console.log(`  ${row.full_name} (${row.email})`);
  }

  console.log("Creating fresh meetups for today…");
  const meetupIds = [];
  for (const meetupSpec of DEMO_MEETUPS) {
    const creator = userRows[meetupSpec.creatorIndex];
    const meetupId = await createMeetupForUser(meetupSpec, Number(creator.id));
    meetupIds.push(meetupId);
    console.log(`  #${meetupId} ${meetupSpec.title} → host ${creator.full_name}`);
  }

  console.log("Auto-joining all 5 users to meetup #1 so the AI coordinator plan is ready to demo…");
  const demoMeetupId = meetupIds[0];
  const hostIndex = DEMO_MEETUPS[0].creatorIndex;
  for (let i = 0; i < userRows.length; i += 1) {
    if (i === hostIndex) continue;
    await query(
      `INSERT INTO meetup_members (meetup_id, user_id, role)
       VALUES ($1, $2, 'member')
       ON CONFLICT DO NOTHING`,
      [demoMeetupId, Number(userRows[i].id)],
    );
  }
  const planResult = await maybeAutoCoordinate(demoMeetupId);
  if (planResult) {
    console.log(`  AI coordinator posted plan #${planResult.id} on meetup #${demoMeetupId}`);
  } else {
    console.log("  Coordinator plan not generated (skipped or threshold not met).");
  }

  console.log("Seeding solo-session demo data so AI suggestions populate…");
  const seedResult = await seedDemoSessions();
  console.log(`  inserted ${seedResult.inserted} synthetic sessions across ${seedResult.seedSpots.length} spots`);

  console.log("Generating AI Suggested Events…");
  const generated = await generateSuggestions();
  console.log(`  ${generated.length} suggestions written to suggested_events`);

  console.log("\nDone. Demo password for all users: " + DEFAULT_PASSWORD);
  console.log("Sign in as any of:");
  for (const u of DEMO_USERS) {
    console.log(`  ${u.fullName.padEnd(18)} ${u.email}`);
  }
}

main()
  .then(async () => {
    await closePool();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("Seed failed:", error);
    await closePool();
    process.exit(1);
  });
