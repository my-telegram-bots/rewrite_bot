ALTER TABLE user_settings
  ADD COLUMN social_media_enabled INTEGER NOT NULL DEFAULT 1
  CHECK (social_media_enabled IN (0, 1));

ALTER TABLE chat_settings
  ADD COLUMN social_media_enabled INTEGER NOT NULL DEFAULT 1
  CHECK (social_media_enabled IN (0, 1));
