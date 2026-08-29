CREATE TABLE user_settings_v2 (
  user_id TEXT PRIMARY KEY,
  cleanup_enabled INTEGER NOT NULL DEFAULT 1 CHECK (cleanup_enabled IN (0, 1)),
  expand_short_urls INTEGER NOT NULL DEFAULT 1 CHECK (expand_short_urls IN (0, 1)),
  remove_referral_marketing INTEGER NOT NULL DEFAULT 0 CHECK (remove_referral_marketing IN (0, 1)),
  hide_mode INTEGER NOT NULL DEFAULT 1,
  hide_disabled TEXT NOT NULL DEFAULT '',
  expired_time_offset INTEGER NOT NULL DEFAULT 0
);

INSERT INTO user_settings_v2
  (user_id, cleanup_enabled, expand_short_urls, remove_referral_marketing,
   hide_mode, hide_disabled, expired_time_offset)
SELECT
  user_id, cleanup_enabled, expand_short_urls, remove_referral_marketing,
  hide_mode, hide_disabled, expired_time_offset
FROM user_settings;

CREATE TABLE user_hide_placeholders_v2 (
  user_id TEXT NOT NULL REFERENCES user_settings_v2(user_id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 0),
  placeholder TEXT NOT NULL CHECK (length(placeholder) > 0),
  PRIMARY KEY (user_id, position)
);

INSERT INTO user_hide_placeholders_v2 (user_id, position, placeholder)
SELECT user_id, position, placeholder FROM user_hide_placeholders;

DROP TABLE user_hide_placeholders;
DROP TABLE user_settings;
ALTER TABLE user_settings_v2 RENAME TO user_settings;
ALTER TABLE user_hide_placeholders_v2 RENAME TO user_hide_placeholders;

CREATE TABLE chat_settings_v2 (
  chat_id TEXT PRIMARY KEY,
  cleanup_enabled INTEGER NOT NULL DEFAULT 1 CHECK (cleanup_enabled IN (0, 1)),
  expand_short_urls INTEGER NOT NULL DEFAULT 1 CHECK (expand_short_urls IN (0, 1)),
  remove_referral_marketing INTEGER NOT NULL DEFAULT 0 CHECK (remove_referral_marketing IN (0, 1)),
  mode TEXT NOT NULL DEFAULT 'replace' CHECK (mode IN ('replace', 'reply', 'off'))
);

INSERT INTO chat_settings_v2
  (chat_id, cleanup_enabled, expand_short_urls, remove_referral_marketing, mode)
SELECT chat_id, cleanup_enabled, expand_short_urls, remove_referral_marketing, mode
FROM chat_settings;

DROP TABLE chat_settings;
ALTER TABLE chat_settings_v2 RENAME TO chat_settings;
