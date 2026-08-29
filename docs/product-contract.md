# Persistence, settings, and URL-cleaning contract

This document is the release contract for the SQLite and URL-cleaning migration.

## Persistence

- The supported runtime is Node.js 22 with one bot process owning one persistent SQLite file.
- Prisma, generated clients, legacy runtime readers, dual reads, and dual writes are forbidden.
- Telegram user and chat identifiers are decimal `TEXT`; JavaScript number coercion is forbidden at the persistence boundary.
- Schema changes run only through the explicit `db:migrate` command. Application startup checks the migration version and never changes schema.
- The shipped systemd unit uses `DynamicUser`, keeps SQLite and its backups in `StateDirectory=rewrite-bot`, imports the stopped legacy Prisma database as that same dynamic user on the first start, loads only secrets from the operator environment file, runs the compiled migration and database check as explicit `ExecStartPre` steps, and starts only the compiled `dist/src/app.js` entry point.
- Migration of an existing database starts with `integrity_check`, creates a non-overwriting consistent backup, and copies all three legacy Prisma tables in one transaction. Row counts and normalized placeholder counts are checked before legacy tables are removed. A failed migration rolls back and prevents startup.
- User settings, normalized hide placeholders, chat settings, hidden inline messages, and hidden normal messages survive process restarts.

## Settings UI

- The Telegram runtime uses grammY directly. Telegraf, its types, and compatibility adapters are forbidden.
- User-facing text is resolved through the official grammY i18n plugin and Fluent locale resources. English and Simplified Chinese resources remain key-for-key synchronized; handlers do not hard-code translatable UI text.
- `/settings` in a private chat edits the caller's user settings. In a group it shows chat settings; every callback that changes group state re-checks administrator status. Non-admin members may view but not mutate.
- The panel has stable text slots and keyboard rows and refreshes by editing the original message.
- Normal tracking cleanup and network short-link expansion default on for imported legacy users and newly created user or group settings. Referral-marketing removal defaults off. Upgrading an existing canonical setting preserves its explicitly stored short-link choice.
- Group mode defaults to `replace`: the original is deleted and the bot republishes the cleaned content, so the visible sender becomes the bot. If deletion is unavailable, the original is retained and the bot replies with the cleaned content plus a human-readable permission explanation.
- Group modes are `replace`, `reply`, and `off`.

## URL and Telegram behavior

- The released ClearURLs snapshot is local and immutable at runtime. Its source revision, checksum, LGPL-3.0 license, and attribution ship with it.
- Standard rules, raw rules, exceptions, referral rules when opted in, and safe HTTP(S) string redirections are supported. Browser-only provider blocking and forced navigation are ignored.
- Local preserve rules protect functional parameters used by Bilibili, Taobao, Tmall, Xianyu, NetEase Music, and the other explicitly listed services.
- Cleaning preserves path text, fragment text, surviving query order, duplicate values, empty values, and original encoding. It never applies a heuristic `decodeURIComponent` rewrite.
- Network expansion is restricted to an explicit source-domain allowlist, follows at most five redirects, has strict timeout and body limits, and rejects credentials, loops, non-HTTP(S) targets, and private, loopback, link-local, multicast, or otherwise non-public addresses after every DNS resolution.
- The allowlist covers explicitly named common generic, platform-owned, and East Asian short-link hosts. Matching is exact and never accepts arbitrary subdomains or suffixes; every addition requires a regression assertion.
- An incoming Telegram text whose first code point is the bot's exact `U+200C` marker is treated as bot-processed output and bypasses URL cleanup, including local parameter removal and network short-link expansion. Other zero-width characters do not trigger this bypass.
- Telegram text is rebuilt from UTF-16 entity offsets without concurrent mutation. Emoji, multiple URLs, repeated URLs, mixed formatting, and `text_link` targets remain valid.
- URL-cleaning results are structured. Logs and user-facing diagnostics never contain complete sensitive URLs.

## Acceptance

- Migration is tested from an untouched legacy three-table fixture, including large Telegram identifiers, Unicode, statuses, timestamps, settings, normal-message data, rollback, and idempotent rerun.
- Tests cover repository constraints and persistence, hide-message consumption and expiry, ClearURLs behavior and snapshot integrity, SSRF rejection, UTF-16 entity rebuilding, settings authorization, and replace/reply/off fallback behavior.
- Release validation includes build, full tests, database checks, a repository-wide forbidden-pattern audit, and bot startup against a migrated database. Telegram live acceptance is reported separately and is never claimed without credentials and actual private/group requests.
