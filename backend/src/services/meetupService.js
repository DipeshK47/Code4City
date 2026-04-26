const { pool, query } = require("../db");
const { createError, normalizeLimit } = require("./serviceUtils");

function userJson(userAlias, photoAlias, includePhoto = false) {
  return `
    json_build_object(
      'id', ${userAlias}.id,
      'username', ${userAlias}.username,
      'fullName', NULLIF(${userAlias}.full_name, ''),
      'profilePhotoUrl', ${includePhoto ? `${photoAlias}.image_url` : "NULL"}
    )
  `;
}

function parseMeetupId(meetupId) {
  const parsed = Number.parseInt(String(meetupId), 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw createError(400, "A valid meetup id is required.");
  }

  return parsed;
}

function requireText(value, fieldName) {
  const normalized = typeof value === "string" ? value.trim() : "";

  if (!normalized) {
    throw createError(400, `${fieldName} is required.`);
  }

  return normalized;
}

function parseCoordinate(value, fieldName) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw createError(400, `${fieldName} must be a valid number.`);
  }

  return parsed;
}

function parseOptionalInteger(value, fieldName) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number.parseInt(String(value), 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw createError(400, `${fieldName} must be a positive integer.`);
  }

  return parsed;
}

function parseTimestamp(value, fieldName) {
  const parsed = new Date(String(value));

  if (Number.isNaN(parsed.getTime())) {
    throw createError(400, `${fieldName} must be a valid date/time.`);
  }

  return parsed;
}

function normalizeMeetupPayload(payload, { allowPast = false } = {}) {
  const title = requireText(payload.title, "Title");
  const description = requireText(payload.description, "Description");
  const locationLabel = requireText(
    payload.locationLabel ?? payload.location_label,
    "Location",
  );
  const lat = parseCoordinate(payload.lat, "lat");
  const lng = parseCoordinate(payload.lng, "lng");
  const startTime = parseTimestamp(
    payload.startTime ?? payload.start_time,
    "startTime",
  );
  const rawEndTime = payload.endTime ?? payload.end_time;
  const endTime = rawEndTime ? parseTimestamp(rawEndTime, "endTime") : null;
  const maxAttendees = parseOptionalInteger(
    payload.maxAttendees ?? payload.max_attendees,
    "maxAttendees",
  );

  if (!allowPast && startTime.getTime() < Date.now() - 60 * 1000) {
    throw createError(400, "Meetups cannot start in the past.");
  }

  if (endTime && endTime <= startTime) {
    throw createError(400, "endTime must be after startTime.");
  }

  return {
    title,
    description,
    locationLabel,
    lat,
    lng,
    startTime: startTime.toISOString(),
    endTime: endTime ? endTime.toISOString() : null,
    maxAttendees,
    autoCreatePost: Boolean(payload.autoCreatePost ?? payload.auto_create_post),
    postTitle:
      typeof payload.postTitle === "string" ? payload.postTitle.trim() : "",
    postBody:
      typeof payload.postBody === "string" ? payload.postBody.trim() : "",
    status: typeof payload.status === "string" ? payload.status.trim() : "active",
  };
}

function buildMeetupPostBody(meetup) {
  const lines = [
    meetup.description,
    `When: ${new Date(meetup.startTime).toLocaleString()}`,
    `Where: ${meetup.locationLabel}`,
  ];

  if (meetup.endTime) {
    lines.push(`Wrap-up: ${new Date(meetup.endTime).toLocaleString()}`);
  }

  return lines.join("\n");
}

function getMeetupSelect(viewerParam = "$1") {
  return `
    SELECT
      meetups.id,
      meetups.created_by,
      meetups.title,
      meetups.description,
      meetups.location_label,
      meetups.lat,
      meetups.lng,
      meetups.start_time,
      meetups.end_time,
      meetups.status,
      meetups.linked_post_id,
      meetups.max_attendees,
      meetups.created_at,
      meetups.updated_at,
      COALESCE(member_counts.joined_count, 0) AS joined_count,
      CASE
        WHEN ${viewerParam}::bigint IS NULL THEN FALSE
        ELSE EXISTS (
          SELECT 1
          FROM meetup_members viewer_memberships
          WHERE viewer_memberships.meetup_id = meetups.id
            AND viewer_memberships.user_id = ${viewerParam}::bigint
        )
      END AS viewer_joined,
      ${userJson("creators", "creator_photos")} AS creator,
      CASE
        WHEN linked_posts.id IS NULL THEN NULL
        ELSE json_build_object(
          'id', linked_posts.id,
          'title', linked_posts.title,
          'body', linked_posts.body
        )
      END AS linked_post,
      COALESCE(members.members, '[]'::json) AS members
    FROM meetups
    JOIN users creators ON creators.id = meetups.created_by
    LEFT JOIN profile_photos creator_photos ON creator_photos.user_id = creators.id
    LEFT JOIN community_posts linked_posts
      ON linked_posts.id = meetups.linked_post_id
     AND linked_posts.deleted_at IS NULL
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS joined_count
      FROM meetup_members
      WHERE meetup_members.meetup_id = meetups.id
    ) AS member_counts ON TRUE
    LEFT JOIN LATERAL (
      SELECT json_agg(
        json_build_object(
          'id', members_user.id,
          'username', members_user.username,
          'fullName', NULLIF(members_user.full_name, ''),
          'profilePhotoUrl', NULL,
          'role', meetup_members.role,
          'joinedAt', meetup_members.joined_at
        )
        ORDER BY meetup_members.joined_at ASC
      ) AS members
      FROM meetup_members
      JOIN users members_user ON members_user.id = meetup_members.user_id
      LEFT JOIN profile_photos members_photo ON members_photo.user_id = members_user.id
      WHERE meetup_members.meetup_id = meetups.id
    ) AS members ON TRUE
  `;
}

function normalizeMeetup(row) {
  if (!row) return null;

  return {
    id: row.id,
    createdBy: row.created_by,
    title: row.title,
    description: row.description,
    locationLabel: row.location_label,
    lat: row.lat,
    lng: row.lng,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    linkedPostId: row.linked_post_id,
    maxAttendees: row.max_attendees,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    joinedCount: row.joined_count,
    viewerJoined: row.viewer_joined,
    creator: row.creator,
    linkedPost: row.linked_post,
    members: row.members ?? [],
  };
}

async function getMeetupByIdInternal(db, meetupId, viewerUserId = null) {
  const result = await db.query(
    `
      ${getMeetupSelect("$1")}
      WHERE meetups.id = $2
      LIMIT 1
    `,
    [viewerUserId, meetupId],
  );

  return normalizeMeetup(result.rows[0]);
}

async function ensureMeetupExists(meetupId, viewerUserId = null) {
  const meetup = await getMeetupByIdInternal({ query }, meetupId, viewerUserId);

  if (!meetup) {
    throw createError(404, "Meetup not found.");
  }

  return meetup;
}

async function ensureJoinedMeetup(meetupId, userId) {
  const result = await query(
    `
      SELECT meetup_id
      FROM meetup_members
      WHERE meetup_id = $1 AND user_id = $2
    `,
    [meetupId, userId],
  );

  if (!result.rows[0]) {
    throw createError(403, "Join the meetup to access its chat.");
  }
}

async function listMeetups({ viewerUserId = null, includePast = false, limit }) {
  const safeLimit = normalizeLimit(limit, 100, 250);
  const result = await query(
    `
      ${getMeetupSelect("$1")}
      WHERE meetups.status <> 'cancelled'
        AND ($2::boolean = TRUE OR meetups.start_time >= NOW())
      ORDER BY meetups.start_time ASC
      LIMIT $3
    `,
    [viewerUserId, includePast, safeLimit],
  );

  return result.rows.map(normalizeMeetup);
}

async function getMeetup(meetupId, viewerUserId = null) {
  const safeMeetupId = parseMeetupId(meetupId);
  const meetup = await ensureMeetupExists(safeMeetupId, viewerUserId);
  return meetup;
}

async function createMeetup(payload, userId) {
  const normalized = normalizeMeetupPayload(payload);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const meetupInsert = await client.query(
      `
        INSERT INTO meetups (
          created_by,
          title,
          description,
          location_label,
          lat,
          lng,
          start_time,
          end_time,
          status,
          max_attendees
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9)
        RETURNING id
      `,
      [
        userId,
        normalized.title,
        normalized.description,
        normalized.locationLabel,
        normalized.lat,
        normalized.lng,
        normalized.startTime,
        normalized.endTime,
        normalized.maxAttendees,
      ],
    );

    const meetupId = meetupInsert.rows[0].id;

    await client.query(
      `
        INSERT INTO meetup_members (meetup_id, user_id, role)
        VALUES ($1, $2, 'creator')
      `,
      [meetupId, userId],
    );

    if (normalized.autoCreatePost) {
      const createdPost = await client.query(
        `
          INSERT INTO community_posts (user_id, title, body, meetup_id)
          VALUES ($1, $2, $3, $4)
          RETURNING id
        `,
        [
          userId,
          normalized.postTitle || normalized.title,
          normalized.postBody || buildMeetupPostBody(normalized),
          meetupId,
        ],
      );

      await client.query(
        `
          UPDATE meetups
          SET linked_post_id = $2, updated_at = NOW()
          WHERE id = $1
        `,
        [meetupId, createdPost.rows[0].id],
      );
    }

    await client.query("COMMIT");
    return getMeetupByIdInternal({ query }, meetupId, userId);
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      throw createError(409, "This meetup is already linked to a community post.");
    }

    throw error;
  } finally {
    client.release();
  }
}

async function updateMeetup(meetupId, userId, payload) {
  const safeMeetupId = parseMeetupId(meetupId);
  const existing = await ensureMeetupExists(safeMeetupId, userId);

  if (Number(existing.createdBy) !== Number(userId)) {
    throw createError(403, "You can only edit your own meetups.");
  }

  const normalized = normalizeMeetupPayload({
    ...existing,
    title: payload.title ?? existing.title,
    description: payload.description ?? existing.description,
    locationLabel: payload.locationLabel ?? payload.location_label ?? existing.locationLabel,
    lat: payload.lat ?? existing.lat,
    lng: payload.lng ?? existing.lng,
    startTime: payload.startTime ?? payload.start_time ?? existing.startTime,
    endTime:
      payload.endTime !== undefined || payload.end_time !== undefined
        ? payload.endTime ?? payload.end_time
        : existing.endTime,
    maxAttendees:
      payload.maxAttendees ?? payload.max_attendees ?? existing.maxAttendees,
  });

  const nextStatus =
    typeof payload.status === "string" && payload.status.trim()
      ? payload.status.trim()
      : existing.status;

  await query(
    `
      UPDATE meetups
      SET
        title = $2,
        description = $3,
        location_label = $4,
        lat = $5,
        lng = $6,
        start_time = $7,
        end_time = $8,
        max_attendees = $9,
        status = $10,
        updated_at = NOW()
      WHERE id = $1
    `,
    [
      safeMeetupId,
      normalized.title,
      normalized.description,
      normalized.locationLabel,
      normalized.lat,
      normalized.lng,
      normalized.startTime,
      normalized.endTime,
      normalized.maxAttendees,
      nextStatus,
    ],
  );

  return getMeetupByIdInternal({ query }, safeMeetupId, userId);
}

async function deleteMeetup(meetupId, userId) {
  const safeMeetupId = parseMeetupId(meetupId);
  const meetup = await ensureMeetupExists(safeMeetupId, userId);

  if (Number(meetup.createdBy) !== Number(userId)) {
    throw createError(403, "You can only cancel your own meetups.");
  }

  await query(
    `
      UPDATE meetups
      SET status = 'cancelled', updated_at = NOW()
      WHERE id = $1
    `,
    [safeMeetupId],
  );
}

async function joinMeetup(meetupId, userId) {
  const safeMeetupId = parseMeetupId(meetupId);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const meetupResult = await client.query(
      `
        SELECT id, status, max_attendees
        FROM meetups
        WHERE id = $1
        FOR UPDATE
      `,
      [safeMeetupId],
    );

    const meetup = meetupResult.rows[0];
    if (!meetup) {
      throw createError(404, "Meetup not found.");
    }

    if (meetup.status === "cancelled") {
      throw createError(400, "Cancelled meetups cannot be joined.");
    }

    const countResult = await client.query(
      `
        SELECT COUNT(*)::int AS joined_count
        FROM meetup_members
        WHERE meetup_id = $1
      `,
      [safeMeetupId],
    );

    const joinedCount = countResult.rows[0].joined_count;
    if (meetup.max_attendees && joinedCount >= meetup.max_attendees) {
      throw createError(400, "This meetup is already full.");
    }

    await client.query(
      `
        INSERT INTO meetup_members (meetup_id, user_id, role)
        VALUES ($1, $2, 'member')
        ON CONFLICT (meetup_id, user_id) DO NOTHING
      `,
      [safeMeetupId, userId],
    );

    await client.query("COMMIT");
    return getMeetupByIdInternal({ query }, safeMeetupId, userId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function leaveMeetup(meetupId, userId) {
  const safeMeetupId = parseMeetupId(meetupId);
  const meetup = await ensureMeetupExists(safeMeetupId, userId);

  if (Number(meetup.createdBy) === Number(userId)) {
    throw createError(400, "Creators cannot leave their own meetup. Cancel it instead.");
  }

  await query(
    `
      DELETE FROM meetup_members
      WHERE meetup_id = $1 AND user_id = $2
    `,
    [safeMeetupId, userId],
  );

  return getMeetupByIdInternal({ query }, safeMeetupId, userId);
}

async function listMeetupMessages(meetupId, userId, limit) {
  const safeMeetupId = parseMeetupId(meetupId);
  await ensureMeetupExists(safeMeetupId, userId);
  await ensureJoinedMeetup(safeMeetupId, userId);

  const safeLimit = normalizeLimit(limit, 100, 250);
  const result = await query(
    `
      SELECT
        messages.id,
        messages.meetup_id,
        messages.user_id,
        messages.message_text,
        messages.created_at,
        messages.updated_at,
        ${userJson("senders", "sender_photos")} AS sender
      FROM meetup_messages messages
      JOIN users senders ON senders.id = messages.user_id
      LEFT JOIN profile_photos sender_photos ON sender_photos.user_id = senders.id
      WHERE messages.meetup_id = $1
      ORDER BY messages.created_at ASC
      LIMIT $2
    `,
    [safeMeetupId, safeLimit],
  );

  return result.rows.map((row) => ({
    id: row.id,
    meetupId: row.meetup_id,
    userId: row.user_id,
    messageText: row.message_text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sender: row.sender,
  }));
}

async function sendMeetupMessage(meetupId, userId, messageText) {
  const safeMeetupId = parseMeetupId(meetupId);
  await ensureMeetupExists(safeMeetupId, userId);
  await ensureJoinedMeetup(safeMeetupId, userId);

  const normalizedMessage = requireText(messageText, "messageText");

  const result = await query(
    `
      INSERT INTO meetup_messages (meetup_id, user_id, message_text)
      VALUES ($1, $2, $3)
      RETURNING id
    `,
    [safeMeetupId, userId, normalizedMessage],
  );

  await query(
    `
      UPDATE meetups
      SET updated_at = NOW()
      WHERE id = $1
    `,
    [safeMeetupId],
  );

  const messages = await listMeetupMessages(safeMeetupId, userId, 250);
  return messages.find((message) => Number(message.id) === Number(result.rows[0].id)) ?? null;
}

module.exports = {
  createMeetup,
  deleteMeetup,
  getMeetup,
  joinMeetup,
  leaveMeetup,
  listMeetupMessages,
  listMeetups,
  sendMeetupMessage,
  updateMeetup,
};
