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

### systemd deployment

The release includes `deploy/rewrite-bot.service` for installations rooted at `/data/bot/rewrite_bot`. It uses a systemd dynamic user, stores the live database and non-overwriting migration backups below `/var/lib/rewrite-bot`, reads secrets from `/data/bot/rewrite_bot/.env`, runs the compiled migration and database check as mandatory pre-start steps, and then starts `dist/src/app.js`.

For an existing Prisma deployment, the old `DATABASE_URL="file:./dev.db"` resolved to `/data/bot/rewrite_bot/prisma/dev.db`. On the first service start, the unit atomically copies that stopped database into its state directory, assigns it to the dynamic user, and migrates the copy. The source database remains untouched. `.env` only needs the secrets:

```dotenv
BOT_TOKEN=replace-with-the-existing-token
MASTER_ID=replace-with-the-existing-owner-id
```

Install and switch from PM2:

```sh
cd /data/bot/rewrite_bot
yarn install --frozen-lockfile
yarn build

pm2 stop rewrite-bot
install -m 0644 deploy/rewrite-bot.service /etc/systemd/system/rewrite-bot.service
systemctl daemon-reload
systemctl enable --now rewrite-bot.service
systemctl status rewrite-bot.service --no-pager
journalctl -u rewrite-bot.service -n 100 --no-pager
```

Only after the systemd service is confirmed healthy should the stopped PM2 process definition be removed and saved. The first migration creates a non-overwriting backup beside `/var/lib/rewrite-bot/rewrite_bot.db` before changing the copied legacy schema.

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

Ordinary cleanup and allowlisted network short-link expansion default on. Referral marketing removal defaults off. Network expansion only accepts explicit source domains, follows at most five redirects, caps responses at 64 KiB, times out, rejects credentials and non-HTTP(S) schemes, and pins each connection to DNS results verified as public addresses.

The exact allowlist includes common generic services (for example Bitly, TinyURL, is.gd, v.gd, ow.ly, and LinkedIn), platform share hosts (YouTube, Google Maps, TikTok, Spotify, SoundCloud, Reddit, and others), and common Chinese/Japanese commerce or social hosts (Bilibili, Taobao, Douyin, Kuaishou, Xiaohongshu, JD, and Amazon). It never uses wildcard or suffix matching.

The bot stores text only when the user invokes hidden-message functionality. Stored data includes the hidden content, Telegram user ID, counters, status, and expiry needed to deliver that feature. User and chat settings are stored persistently. Full URLs are not written to application logs. `/clean` deletes the caller's hidden inline messages.

Messages beginning with the bot's exact `U+200C` marker are treated as output already produced by the bot and bypass URL cleanup and short-link expansion. Other zero-width characters do not trigger this bypass.

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
