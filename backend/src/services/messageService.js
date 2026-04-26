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

function parseThreadId(threadId) {
  const parsed = Number.parseInt(String(threadId), 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw createError(400, "A valid thread id is required.");
  }

  return parsed;
}

function requireMessageText(value) {
  const normalized = typeof value === "string" ? value.trim() : "";

  if (!normalized) {
    throw createError(400, "messageText is required.");
  }

  return normalized;
}

async function getDirectThreadByParticipants(db, userId, otherUserId) {
  const result = await db.query(
    `
      SELECT threads.id
      FROM dm_threads threads
      JOIN dm_thread_members self_membership
        ON self_membership.thread_id = threads.id
       AND self_membership.user_id = $1
      JOIN dm_thread_members other_membership
        ON other_membership.thread_id = threads.id
       AND other_membership.user_id = $2
      WHERE (
        SELECT COUNT(*)
        FROM dm_thread_members all_members
        WHERE all_members.thread_id = threads.id
      ) = 2
      LIMIT 1
    `,
    [userId, otherUserId],
  );

  return result.rows[0]?.id ?? null;
}

async function ensureOtherUserExists(otherUserId) {
  const result = await query(
    `
      SELECT id
      FROM users
      WHERE id = $1
    `,
    [otherUserId],
  );

  if (!result.rows[0]) {
    throw createError(404, "User not found.");
  }
}

function getThreadSelect() {
  return `
    SELECT
      threads.id,
      threads.created_at,
      threads.updated_at,
      json_build_object(
        'id', other_users.id,
        'username', other_users.username,
        'fullName', NULLIF(other_users.full_name, ''),
        'profilePhotoUrl', NULL
      ) AS other_user,
      last_message.message_text AS last_message_text,
      last_message.created_at AS last_message_at,
      COALESCE(unread_counts.unread_count, 0) AS unread_count
    FROM dm_threads threads
    JOIN dm_thread_members self_memberships
      ON self_memberships.thread_id = threads.id
     AND self_memberships.user_id = $1
    JOIN LATERAL (
      SELECT users.id, users.username, users.full_name, profile_photos.image_url
      FROM dm_thread_members other_memberships
      JOIN users ON users.id = other_memberships.user_id
      LEFT JOIN profile_photos ON profile_photos.user_id = users.id
      WHERE other_memberships.thread_id = threads.id
        AND other_memberships.user_id <> $1
      LIMIT 1
    ) AS other_users ON TRUE
    LEFT JOIN LATERAL (
      SELECT dm_messages.message_text, dm_messages.created_at
      FROM dm_messages
      WHERE dm_messages.thread_id = threads.id
      ORDER BY dm_messages.created_at DESC
      LIMIT 1
    ) AS last_message ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS unread_count
      FROM dm_messages
      WHERE dm_messages.thread_id = threads.id
        AND dm_messages.sender_user_id <> $1
        AND dm_messages.read_at IS NULL
    ) AS unread_counts ON TRUE
    WHERE (
      SELECT COUNT(*)
      FROM dm_thread_members all_memberships
      WHERE all_memberships.thread_id = threads.id
    ) = 2
  `;
}

function normalizeThread(row) {
  if (!row) return null;

  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    otherUser: row.other_user,
    lastMessageText: row.last_message_text,
    lastMessageAt: row.last_message_at,
    unreadCount: row.unread_count,
  };
}

async function ensureThreadMembership(threadId, userId) {
  const result = await query(
    `
      SELECT 1
      FROM dm_thread_members
      WHERE thread_id = $1 AND user_id = $2
    `,
    [threadId, userId],
  );

  if (!result.rows[0]) {
    throw createError(404, "Thread not found.");
  }
}

async function listThreads(userId) {
  const result = await query(
    `
      ${getThreadSelect()}
        AND last_message.created_at IS NOT NULL
      ORDER BY COALESCE(last_message.created_at, threads.updated_at, threads.created_at) DESC
    `,
    [userId],
  );

  return result.rows.map(normalizeThread);
}

async function createOrGetThread(userId, otherUserId) {
  const safeOtherUserId = Number.parseInt(String(otherUserId), 10);

  if (!Number.isInteger(safeOtherUserId) || safeOtherUserId <= 0) {
    throw createError(400, "otherUserId is required.");
  }

  if (Number(userId) === safeOtherUserId) {
    throw createError(400, "You cannot message yourself.");
  }

  await ensureOtherUserExists(safeOtherUserId);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingThreadId = await getDirectThreadByParticipants(
      client,
      userId,
      safeOtherUserId,
    );

    if (existingThreadId) {
      await client.query("COMMIT");
      return getThread(existingThreadId, userId);
    }

    const threadInsert = await client.query(
      `
        INSERT INTO dm_threads DEFAULT VALUES
        RETURNING id
      `,
    );

    const threadId = threadInsert.rows[0].id;

    await client.query(
      `
        INSERT INTO dm_thread_members (thread_id, user_id)
        VALUES ($1, $2), ($1, $3)
      `,
      [threadId, userId, safeOtherUserId],
    );

    await client.query("COMMIT");
    return getThread(threadId, userId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getThread(threadId, userId) {
  const safeThreadId = parseThreadId(threadId);
  const result = await query(
    `
      ${getThreadSelect()}
        AND threads.id = $2
      LIMIT 1
    `,
    [userId, safeThreadId],
  );

  const thread = normalizeThread(result.rows[0]);

  if (!thread) {
    throw createError(404, "Thread not found.");
  }

  return thread;
}

async function listThreadMessages(threadId, userId, limit) {
  const safeThreadId = parseThreadId(threadId);
  await ensureThreadMembership(safeThreadId, userId);

  await query(
    `
      UPDATE dm_messages
      SET read_at = NOW()
      WHERE thread_id = $1
        AND sender_user_id <> $2
        AND read_at IS NULL
    `,
    [safeThreadId, userId],
  );

  const safeLimit = normalizeLimit(limit, 100, 250);
  const result = await query(
    `
      SELECT
        dm_messages.id,
        dm_messages.thread_id,
        dm_messages.sender_user_id,
        dm_messages.message_text,
        dm_messages.created_at,
        dm_messages.updated_at,
        dm_messages.read_at,
        ${userJson("senders", "sender_photos")} AS sender
      FROM dm_messages
      JOIN users senders ON senders.id = dm_messages.sender_user_id
      LEFT JOIN profile_photos sender_photos ON sender_photos.user_id = senders.id
      WHERE dm_messages.thread_id = $1
      ORDER BY dm_messages.created_at ASC
      LIMIT $2
    `,
    [safeThreadId, safeLimit],
  );

  return result.rows.map((row) => ({
    id: row.id,
    threadId: row.thread_id,
    senderUserId: row.sender_user_id,
    messageText: row.message_text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    readAt: row.read_at,
    sender: row.sender,
  }));
}

async function sendThreadMessage(threadId, userId, messageText) {
  const safeThreadId = parseThreadId(threadId);
  await ensureThreadMembership(safeThreadId, userId);

  const normalizedMessage = requireMessageText(messageText);

  const result = await query(
    `
      INSERT INTO dm_messages (thread_id, sender_user_id, message_text)
      VALUES ($1, $2, $3)
      RETURNING id
    `,
    [safeThreadId, userId, normalizedMessage],
  );

  await query(
    `
      UPDATE dm_threads
      SET updated_at = NOW()
      WHERE id = $1
    `,
    [safeThreadId],
  );

  const messages = await listThreadMessages(safeThreadId, userId, 250);
  return messages.find((message) => Number(message.id) === Number(result.rows[0].id)) ?? null;
}

async function searchUsers(currentUserId, searchQuery) {
  const trimmed = (searchQuery || "").trim();
  if (!trimmed) {
    const result = await query(
      `SELECT id, username, full_name AS "fullName"
       FROM users
       WHERE id <> $1
       ORDER BY username ASC
       LIMIT 20`,
      [currentUserId],
    );
    return result.rows;
  }

  const pattern = `%${trimmed}%`;
  const result = await query(
    `SELECT id, username, full_name AS "fullName"
     FROM users
     WHERE id <> $1
       AND (username ILIKE $2 OR full_name ILIKE $2)
     ORDER BY username ASC
     LIMIT 20`,
    [currentUserId, pattern],
  );
  return result.rows;
}

module.exports = {
  createOrGetThread,
  getThread,
  listThreadMessages,
  listThreads,
  searchUsers,
  sendThreadMessage,
};
