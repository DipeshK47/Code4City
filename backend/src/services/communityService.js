const { query } = require("../db");
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

function getPostSelect(viewerParam = "$1") {
  return `
    SELECT
      posts.id,
      posts.user_id,
      posts.title,
      posts.body,
      posts.like_count,
      posts.comment_count,
      posts.created_at,
      posts.updated_at,
      ${userJson("authors", "author_photos")} AS author,
      CASE
        WHEN ${viewerParam}::bigint IS NULL THEN FALSE
        ELSE EXISTS (
          SELECT 1
          FROM post_likes viewer_likes
          WHERE viewer_likes.post_id = posts.id
            AND viewer_likes.user_id = ${viewerParam}::bigint
        )
      END AS viewer_has_liked,
      CASE
        WHEN meetups.id IS NULL THEN NULL
        ELSE json_build_object(
          'id', meetups.id,
          'title', meetups.title,
          'description', meetups.description,
          'locationLabel', meetups.location_label,
          'lat', meetups.lat,
          'lng', meetups.lng,
          'startTime', meetups.start_time,
          'endTime', meetups.end_time,
          'status', meetups.status,
          'maxAttendees', meetups.max_attendees,
          'createdAt', meetups.created_at,
          'updatedAt', meetups.updated_at,
          'joinedCount', COALESCE(meetup_member_counts.joined_count, 0),
          'viewerJoined',
            CASE
              WHEN ${viewerParam}::bigint IS NULL THEN FALSE
              ELSE EXISTS (
                SELECT 1
                FROM meetup_members viewer_memberships
                WHERE viewer_memberships.meetup_id = meetups.id
                  AND viewer_memberships.user_id = ${viewerParam}::bigint
              )
            END,
          'creator', ${userJson("meetup_creators", "meetup_creator_photos")}
        )
      END AS meetup
    FROM community_posts posts
    JOIN users authors ON authors.id = posts.user_id
    LEFT JOIN profile_photos author_photos ON author_photos.user_id = authors.id
    LEFT JOIN meetups ON meetups.id = posts.meetup_id
    LEFT JOIN users meetup_creators ON meetup_creators.id = meetups.created_by
    LEFT JOIN profile_photos meetup_creator_photos ON meetup_creator_photos.user_id = meetup_creators.id
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS joined_count
      FROM meetup_members
      WHERE meetup_members.meetup_id = meetups.id
    ) AS meetup_member_counts ON TRUE
    WHERE posts.deleted_at IS NULL
  `;
}

function normalizePost(row) {
  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    body: row.body,
    likeCount: row.like_count,
    commentCount: row.comment_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    viewerHasLiked: row.viewer_has_liked,
    author: row.author,
    meetup: row.meetup,
  };
}

function normalizeComment(row) {
  return {
    id: row.id,
    postId: row.post_id,
    userId: row.user_id,
    parentCommentId: row.parent_comment_id,
    body: row.deleted_at ? null : row.body,
    isDeleted: Boolean(row.deleted_at),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    author: row.author,
    replies: [],
  };
}

function parsePostId(postId) {
  const parsed = Number.parseInt(String(postId), 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw createError(400, "A valid post id is required.");
  }

  return parsed;
}

function requireBody(value, fieldName) {
  const normalized = typeof value === "string" ? value.trim() : "";

  if (!normalized) {
    throw createError(400, `${fieldName} is required.`);
  }

  return normalized;
}

async function ensureActivePost(postId) {
  const result = await query(
    `
      SELECT id, user_id
      FROM community_posts
      WHERE id = $1 AND deleted_at IS NULL
    `,
    [postId],
  );

  const post = result.rows[0];
  if (!post) {
    throw createError(404, "Post not found.");
  }

  return post;
}

async function refreshPostCounts(db, postId) {
  await db.query(
    `
      UPDATE community_posts
      SET
        like_count = (
          SELECT COUNT(*)
          FROM post_likes
          WHERE post_id = $1
        ),
        comment_count = (
          SELECT COUNT(*)
          FROM post_comments
          WHERE post_id = $1
            AND deleted_at IS NULL
        )
      WHERE id = $1
    `,
    [postId],
  );
}

async function listPosts({ viewerUserId = null, limit }) {
  const safeLimit = normalizeLimit(limit, 25, 100);
  const result = await query(
    `
      ${getPostSelect("$1")}
      ORDER BY posts.created_at DESC
      LIMIT $2
    `,
    [viewerUserId, safeLimit],
  );

  return result.rows.map(normalizePost);
}

async function getPost(postId, viewerUserId = null) {
  const safePostId = parsePostId(postId);
  const result = await query(
    `
      ${getPostSelect("$1")}
        AND posts.id = $2
      LIMIT 1
    `,
    [viewerUserId, safePostId],
  );

  const post = normalizePost(result.rows[0]);

  if (!post) {
    throw createError(404, "Post not found.");
  }

  return post;
}

async function createPost({ userId, title, body, meetupId = null }) {
  const normalizedTitle = requireBody(title, "Title");
  const normalizedBody = requireBody(body, "Body");
  const resolvedMeetupId =
    meetupId === null || meetupId === undefined || meetupId === ""
      ? null
      : Number.parseInt(String(meetupId), 10);

  if (resolvedMeetupId !== null) {
    if (!Number.isInteger(resolvedMeetupId) || resolvedMeetupId <= 0) {
      throw createError(400, "meetupId must be a valid meetup id.");
    }
  }

  const result = await query(
    `
      INSERT INTO community_posts (user_id, title, body, meetup_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `,
    [userId, normalizedTitle, normalizedBody, resolvedMeetupId],
  );

  return getPost(result.rows[0].id, userId);
}

async function updatePost(postId, userId, payload) {
  const safePostId = parsePostId(postId);
  const post = await ensureActivePost(safePostId);

  if (Number(post.user_id) !== Number(userId)) {
    throw createError(403, "You can only edit your own posts.");
  }

  const normalizedTitle = requireBody(payload.title, "Title");
  const normalizedBody = requireBody(payload.body, "Body");

  await query(
    `
      UPDATE community_posts
      SET title = $2, body = $3, updated_at = NOW()
      WHERE id = $1
    `,
    [safePostId, normalizedTitle, normalizedBody],
  );

  return getPost(safePostId, userId);
}

async function deletePost(postId, userId) {
  const safePostId = parsePostId(postId);
  const post = await ensureActivePost(safePostId);

  if (Number(post.user_id) !== Number(userId)) {
    throw createError(403, "You can only delete your own posts.");
  }

  await query(
    `
      UPDATE community_posts
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = $1
    `,
    [safePostId],
  );
}

async function likePost(postId, userId) {
  const safePostId = parsePostId(postId);
  await ensureActivePost(safePostId);

  await query(
    `
      INSERT INTO post_likes (post_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `,
    [safePostId, userId],
  );

  await refreshPostCounts({ query }, safePostId);
  return getPost(safePostId, userId);
}

async function unlikePost(postId, userId) {
  const safePostId = parsePostId(postId);
  await ensureActivePost(safePostId);

  await query(
    `
      DELETE FROM post_likes
      WHERE post_id = $1 AND user_id = $2
    `,
    [safePostId, userId],
  );

  await refreshPostCounts({ query }, safePostId);
  return getPost(safePostId, userId);
}

async function listComments(postId) {
  const safePostId = parsePostId(postId);
  await ensureActivePost(safePostId);

  const result = await query(
    `
      SELECT
        comments.id,
        comments.post_id,
        comments.user_id,
        comments.parent_comment_id,
        comments.body,
        comments.created_at,
        comments.updated_at,
        comments.deleted_at,
        ${userJson("authors", "author_photos")} AS author
      FROM post_comments comments
      JOIN users authors ON authors.id = comments.user_id
      LEFT JOIN profile_photos author_photos ON author_photos.user_id = authors.id
      WHERE comments.post_id = $1
      ORDER BY comments.created_at ASC
    `,
    [safePostId],
  );

  const commentsById = new Map();
  const roots = [];

  for (const row of result.rows) {
    const comment = normalizeComment(row);
    commentsById.set(comment.id, comment);
  }

  for (const comment of commentsById.values()) {
    if (comment.parentCommentId && commentsById.has(comment.parentCommentId)) {
      commentsById.get(comment.parentCommentId).replies.push(comment);
    } else {
      roots.push(comment);
    }
  }

  return roots;
}

async function createComment({ postId, userId, body, parentCommentId = null }) {
  const safePostId = parsePostId(postId);
  await ensureActivePost(safePostId);
  const normalizedBody = requireBody(body, "Body");

  if (parentCommentId !== null) {
    const parentResult = await query(
      `
        SELECT id, post_id
        FROM post_comments
        WHERE id = $1 AND deleted_at IS NULL
      `,
      [parentCommentId],
    );

    const parent = parentResult.rows[0];

    if (!parent || Number(parent.post_id) !== safePostId) {
      throw createError(404, "Parent comment not found.");
    }
  }

  await query(
    `
      INSERT INTO post_comments (post_id, user_id, parent_comment_id, body)
      VALUES ($1, $2, $3, $4)
    `,
    [safePostId, userId, parentCommentId, normalizedBody],
  );

  await refreshPostCounts({ query }, safePostId);
  return listComments(safePostId);
}

async function createReply(commentId, userId, body) {
  const safeCommentId = Number.parseInt(String(commentId), 10);

  if (!Number.isInteger(safeCommentId) || safeCommentId <= 0) {
    throw createError(400, "A valid comment id is required.");
  }

  const result = await query(
    `
      SELECT id, post_id
      FROM post_comments
      WHERE id = $1 AND deleted_at IS NULL
    `,
    [safeCommentId],
  );

  const parentComment = result.rows[0];
  if (!parentComment) {
    throw createError(404, "Comment not found.");
  }

  return createComment({
    postId: parentComment.post_id,
    userId,
    body,
    parentCommentId: safeCommentId,
  });
}

async function deleteComment(commentId, userId) {
  const safeCommentId = Number.parseInt(String(commentId), 10);

  if (!Number.isInteger(safeCommentId) || safeCommentId <= 0) {
    throw createError(400, "A valid comment id is required.");
  }

  const result = await query(
    `
      SELECT id, post_id, user_id, deleted_at
      FROM post_comments
      WHERE id = $1
    `,
    [safeCommentId],
  );

  const comment = result.rows[0];
  if (!comment) {
    throw createError(404, "Comment not found.");
  }

  if (Number(comment.user_id) !== Number(userId)) {
    throw createError(403, "You can only delete your own comments.");
  }

  if (!comment.deleted_at) {
    await query(
      `
        UPDATE post_comments
        SET deleted_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `,
      [safeCommentId],
    );
    await refreshPostCounts({ query }, comment.post_id);
  }

  return listComments(comment.post_id);
}

module.exports = {
  createComment,
  createPost,
  createReply,
  deleteComment,
  deletePost,
  getPost,
  likePost,
  listComments,
  listPosts,
  unlikePost,
  updatePost,
};
