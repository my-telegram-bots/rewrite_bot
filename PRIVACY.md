# Privacy policy

rewrite_bot processes Telegram updates to provide link cleaning and text utilities.

- Ordinary URL cleanup runs locally. The bot does not log complete URLs.
- Short-link expansion makes outbound requests only when the applicable user or group setting is enabled. It sends the short URL to the destination service as required to resolve it; SSRF and redirect controls are described in `readme.md`.
- Hidden-message functionality stores the submitted text, Telegram user ID, status, read counters, and expiry needed to deliver that feature.
- Message-mode hidden content from existing deployments is preserved during database migration.
- User and group settings are stored persistently in SQLite. Telegram IDs are stored as decimal text.
- `/clean` deletes the caller's hidden inline messages. Group administrators control group settings through `/settings`.
- ClearURLs rules are a bundled local data asset and are never downloaded while the bot is running.
- When an inline query or directly sent text message contains an X/Twitter or Bluesky post URL and the applicable social-media setting is enabled, the bot sends only the public post identifier and, for Bluesky, its public handle to the corresponding FxEmbed metadata API. FxEmbed also receives the bot server IP and application User-Agent. The full query or message, unrelated URLs, Telegram user ID, and hidden-message text are not sent. Media files are fetched by Telegram from the public media URL; they are not downloaded into this bot's database or filesystem.

Operators are responsible for protecting the SQLite database and its migration backups, restricting filesystem access, and deleting backups according to their retention policy after release acceptance.
