# rewrite_bot

rewrite_bot is a grammY-based Telegram utility bot for removing tracking data from links, safely expanding approved short links, and hiding text.

## Runtime

- Node.js 22 or later
- One bot process with one persistent SQLite database
- `better-sqlite3`; schema migrations are plain versioned SQL
- grammY with the official i18n plugin; English and Simplified Chinese Fluent resources ship in `locales/`
- A release-pinned ClearURLs rules snapshot; no runtime rules download

## Setup

```sh
yarn install --frozen-lockfile
# Set BOT_TOKEN, MASTER_ID, and DATABASE_PATH in the service environment.
yarn db:migrate
yarn db:check
yarn rules:check
yarn build
yarn start
```

Application startup checks the expected migration version and refuses to start when the explicit migration has not run. It never changes the schema automatically.

## Settings

Run `/settings` in a private chat to manage personal cleanup, allowlisted short-link expansion, referral cleanup, and hidden-message presentation. Run it in a group to view group settings. Every group callback rechecks Telegram administrator status; ordinary members can view but cannot change settings.

Group modes are:

- `replace` (default): the bot replies with the clean message and then deletes the original, leaving the bot as the visible sender.
- `reply`: keep the original and reply with the clean message.
- `off`: do not clean group messages.

If deletion fails, both the original and clean reply are kept and the bot posts an adjacent permission explanation with code `URL_DELETE_PERMISSION`.

## Database migration, backup, and restore

`yarn db:migrate` first runs SQLite `integrity_check`. For every existing pre-migration database it creates a consistent, non-overwriting sibling backup named `<database>.backup-<timestamp>`. It migrates all legacy hidden messages, message-mode rows, settings, Unicode text, statuses, counters, and timestamps in one transaction. A failure rolls back and prevents the new runtime from starting.

To restore:

1. Stop the bot.
2. Preserve the failed/current database for investigation.
3. Copy the selected `.backup-<timestamp>` file to the exact `DATABASE_PATH`.
4. Run `yarn db:check` against that restored database.
5. Start the matching application version, or rerun `yarn db:migrate` before starting this version.

Never overwrite or delete a backup until the migrated bot has passed real Telegram acceptance.

## URL-cleaning security and privacy

Ordinary cleanup is local. Referral marketing removal and network short-link expansion default off. Network expansion only accepts explicit source domains, follows at most five redirects, caps responses at 64 KiB, times out, rejects credentials and non-HTTP(S) schemes, and pins each connection to DNS results verified as public addresses.

The exact allowlist includes common generic services (for example Bitly, TinyURL, is.gd, v.gd, ow.ly, and LinkedIn), platform share hosts (YouTube, Google Maps, TikTok, Spotify, SoundCloud, Reddit, and others), and common Chinese/Japanese commerce or social hosts (Bilibili, Taobao, Douyin, Kuaishou, Xiaohongshu, JD, and Amazon). It never uses wildcard or suffix matching.

The bot stores text only when the user invokes hidden-message functionality. Stored data includes the hidden content, Telegram user ID, counters, status, and expiry needed to deliver that feature. User and chat settings are stored persistently. Full URLs are not written to application logs. `/clean` deletes the caller's hidden inline messages.

## ClearURLs attribution

The rules data in `vendor/clearurls/` comes from [ClearURLs Rules](https://github.com/ClearURLs/Rules), is pinned to the revision and SHA-256 listed in `vendor/clearurls/SOURCE.md`, and is licensed under LGPL-3.0. The upstream license is included at `vendor/clearurls/LICENSE`. This project treats the rules as a separately attributed release asset.

Run `yarn rules:check` to validate its schema, regexes, checksum, size, source metadata, license, and synchronized locale keys.

## Validation

```sh
yarn rules:check
yarn test
yarn build
```

Telegram live acceptance requires a test bot token and a test group; unit/build results are not a substitute.

## License

Application source: MIT. Vendored ClearURLs rules: LGPL-3.0 as described above.
