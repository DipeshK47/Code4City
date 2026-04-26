CREATE TABLE IF NOT EXISTS meetups (
  id BIGSERIAL PRIMARY KEY,
  created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location_label TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  linked_post_id BIGINT,
  max_attendees INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_posts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  meetup_id BIGINT REFERENCES meetups(id) ON DELETE SET NULL,
  like_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS post_likes (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_comments (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_comment_id BIGINT REFERENCES post_comments(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS meetup_members (
  id BIGSERIAL PRIMARY KEY,
  meetup_id BIGINT NOT NULL REFERENCES meetups(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  role TEXT NOT NULL DEFAULT 'member'
);

CREATE TABLE IF NOT EXISTS meetup_messages (
  id BIGSERIAL PRIMARY KEY,
  meetup_id BIGINT NOT NULL REFERENCES meetups(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dm_threads (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dm_thread_members (
  id BIGSERIAL PRIMARY KEY,
  thread_id BIGINT NOT NULL REFERENCES dm_threads(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dm_messages (
  id BIGSERIAL PRIMARY KEY,
  thread_id BIGINT NOT NULL REFERENCES dm_threads(id) ON DELETE CASCADE,
  sender_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

ALTER TABLE meetups
  ADD COLUMN IF NOT EXISTS linked_post_id BIGINT;

ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS meetup_id BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'meetups_linked_post_id_fkey'
  ) THEN
    ALTER TABLE meetups
      ADD CONSTRAINT meetups_linked_post_id_fkey
      FOREIGN KEY (linked_post_id) REFERENCES community_posts(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_post_likes_unique
  ON post_likes (post_id, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_meetup_members_unique
  ON meetup_members (meetup_id, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dm_thread_members_unique
  ON dm_thread_members (thread_id, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_meetups_linked_post_id
  ON meetups (linked_post_id)
  WHERE linked_post_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_community_posts_meetup_id
  ON community_posts (meetup_id)
  WHERE meetup_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_community_posts_created_at
  ON community_posts (created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_post_comments_post_id
  ON post_comments (post_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_post_comments_parent_comment_id
  ON post_comments (parent_comment_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_meetups_start_time
  ON meetups (start_time ASC);

CREATE INDEX IF NOT EXISTS idx_meetups_status_start_time
  ON meetups (status, start_time ASC);

CREATE INDEX IF NOT EXISTS idx_meetups_lat_lng
  ON meetups (lat, lng);

CREATE INDEX IF NOT EXISTS idx_meetup_messages_meetup_id
  ON meetup_messages (meetup_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_dm_messages_thread_id
  ON dm_messages (thread_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_dm_messages_read_at
  ON dm_messages (thread_id, read_at);

DROP TRIGGER IF EXISTS trg_community_posts_updated_at ON community_posts;
CREATE TRIGGER trg_community_posts_updated_at
BEFORE UPDATE ON community_posts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_post_comments_updated_at ON post_comments;
CREATE TRIGGER trg_post_comments_updated_at
BEFORE UPDATE ON post_comments
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_meetups_updated_at ON meetups;
CREATE TRIGGER trg_meetups_updated_at
BEFORE UPDATE ON meetups
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_meetup_messages_updated_at ON meetup_messages;
CREATE TRIGGER trg_meetup_messages_updated_at
BEFORE UPDATE ON meetup_messages
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_dm_threads_updated_at ON dm_threads;
CREATE TRIGGER trg_dm_threads_updated_at
BEFORE UPDATE ON dm_threads
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_dm_messages_updated_at ON dm_messages;
CREATE TRIGGER trg_dm_messages_updated_at
BEFORE UPDATE ON dm_messages
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();
