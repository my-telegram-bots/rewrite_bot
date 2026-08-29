CREATE TABLE hidden_messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  max_count INTEGER NOT NULL DEFAULT 0 CHECK (max_count >= 0),
  status INTEGER NOT NULL DEFAULT 0,
  time INTEGER NOT NULL,
  expired_time INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX hidden_messages_user_id_idx ON hidden_messages(user_id);
CREATE INDEX hidden_messages_expiry_idx ON hidden_messages(expired_time);

CREATE TABLE hidden_normal_messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  message_type INTEGER NOT NULL DEFAULT 1,
  text TEXT NOT NULL DEFAULT '',
  time INTEGER NOT NULL
);

CREATE INDEX hidden_normal_messages_lookup_idx ON hidden_normal_messages(user_id, message_id);

CREATE TABLE user_settings (
  user_id TEXT PRIMARY KEY,
  cleanup_enabled INTEGER NOT NULL DEFAULT 1 CHECK (cleanup_enabled IN (0, 1)),
  expand_short_urls INTEGER NOT NULL DEFAULT 0 CHECK (expand_short_urls IN (0, 1)),
  remove_referral_marketing INTEGER NOT NULL DEFAULT 0 CHECK (remove_referral_marketing IN (0, 1)),
  hide_mode INTEGER NOT NULL DEFAULT 1,
  hide_disabled TEXT NOT NULL DEFAULT '',
  expired_time_offset INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE user_hide_placeholders (
  user_id TEXT NOT NULL REFERENCES user_settings(user_id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 0),
  placeholder TEXT NOT NULL CHECK (length(placeholder) > 0),
  PRIMARY KEY (user_id, position)
);

CREATE TABLE chat_settings (
  chat_id TEXT PRIMARY KEY,
  cleanup_enabled INTEGER NOT NULL DEFAULT 1 CHECK (cleanup_enabled IN (0, 1)),
  expand_short_urls INTEGER NOT NULL DEFAULT 0 CHECK (expand_short_urls IN (0, 1)),
  remove_referral_marketing INTEGER NOT NULL DEFAULT 0 CHECK (remove_referral_marketing IN (0, 1)),
  mode TEXT NOT NULL DEFAULT 'replace' CHECK (mode IN ('replace', 'reply', 'off'))
);

CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL
);
