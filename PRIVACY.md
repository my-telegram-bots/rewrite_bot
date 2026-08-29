# Privacy policy

rewrite_bot processes Telegram updates to provide link cleaning and text utilities.

- Ordinary URL cleanup runs locally. The bot does not log complete URLs.
- Short-link expansion makes outbound requests only when the applicable user or group setting is enabled. It sends the short URL to the destination service as required to resolve it; SSRF and redirect controls are described in `readme.md`.
- Hidden-message functionality stores the submitted text, Telegram user ID, status, read counters, and expiry needed to deliver that feature.
- Message-mode hidden content from existing deployments is preserved during database migration.
- User and group settings are stored persistently in SQLite. Telegram IDs are stored as decimal text.
- `/clean` deletes the caller's hidden inline messages. Group administrators control group settings through `/settings`.
- ClearURLs rules are a bundled local data asset and are never downloaded while the bot is running.

Operators are responsible for protecting the SQLite database and its migration backups, restricting filesystem access, and deleting backups according to their retention policy after release acceptance.
