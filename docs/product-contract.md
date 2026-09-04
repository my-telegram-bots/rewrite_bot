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
- Every process start synchronizes Telegram's command menu through grammY `setMyCommands`. English and Simplified Chinese descriptions are registered automatically; private chats expose `/start`, `/settings`, `/clean`, and `/id`, while group chats expose only `/settings` and `/id`.
- `/settings` in a private chat edits the caller's user settings. In a group it shows chat settings; every callback that changes group state re-checks administrator status. Non-admin members may view but not mutate.
- The panel has stable text slots and keyboard rows and refreshes by editing the original message.
- Normal tracking cleanup, network short-link expansion, and social-media parsing default on for imported legacy users and newly created user or group settings. Referral-marketing removal defaults off. Upgrading an existing canonical setting preserves its explicitly stored short-link choice and enables social-media parsing unless the user or group later turns it off.
- User and group settings persist one multi-image delivery mode with exactly two values: `media_group` (default) sends all original photos as a Telegram album, while `combine` sends FxTwitter's combined JPEG when available. Group callbacks for this mode re-check administrator status. Existing settings migrate to `media_group` without changing other choices.
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

## Downloadable social media

- Inline queries and directly sent text messages recognize exact public post URLs on `twitter.com`, `x.com`, and `bsky.app`. Similar-looking hosts, profile URLs, malformed identifiers, and arbitrary URLs never trigger a metadata request.
- One persistent `social_media_enabled` setting controls both inline parsing for a user and directly sent message parsing for that user or group. It defaults on. Group callbacks re-check administrator status. Turning it off prevents FxEmbed requests while preserving link cleanup and link-only variants.
- The first supported post URL in one inline query is resolved through the public FxEmbed API v2: `api.fxtwitter.com/2/status/{id}` for X/Twitter and `api.fxbsky.app/2/status/{handle}/{rkey}` for Bluesky.
- Metadata requests use only those fixed HTTPS origins, identify this application, reject redirects, time out after four seconds, and read at most 512 KiB of JSON. They never download the media bytes into the bot process.
- Original photos and Telegram-compatible progressive MP4/H.264 videos become native inline media results ahead of link-only variants. Selecting one sends a Telegram photo or video that the recipient can download. Multi-photo X/Twitter posts additionally expose FxTwitter's JPEG mosaic as the first inline result, explicitly labeled as the combined image, without replacing any selectable original item; external player cards, HLS playlists, and incompatible video codecs are not substituted for originals.
- A valid post whose own top-level payload contains no media is a normal text-only result, not a media failure. Quoted-post media and link-preview images never count as the requested post's media. Social-media delivery sends no direct diagnostic or replacement and never deletes the original on its own; when ordinary URL cleanup made no change, handling is completely silent and retains the original, while a real cleanup change continues through the existing private/reply/replace/off cleanup flow. Inline handling keeps every link-only and utility result and may add an informational `MEDIA_NOT_FOUND` result that explicitly says the post itself may be text-only. If the top-level post does contain media but every original is incompatible or untrusted, the existing `MEDIA_NOT_FOUND` diagnostic remains an error result.
- For directly sent links, compatible media is sent before any destructive action. In default `media_group` mode, two or more photos/videos use a Telegram media group while animations and mixed unsupported album combinations retain source order as individual replies. In `combine` mode, an available trusted FxTwitter JPEG mosaic replaces a multi-photo album; posts without a trusted combined image retain normal media-group behavior. In a group, a successful media delivery obeys the group mode: `replace` deletes the original link only after the replacement media was sent, while `reply` and `off` retain it. If deletion fails, both messages remain and the bot posts the localized `URL_DELETE_PERMISSION` recovery explanation. Lookup failures and media-send failures never delete the original.
- Inline and direct media captions share one stable layout: the post body is a Telegram `blockquote`, followed by an author line whose handle links to the canonical Twitter or Bluesky profile, and a localized `View original post` text link. The exact `U+200C` processed marker remains the first code point and all entity offsets use Telegram UTF-16 units.
- A lookup failure or a post whose top-level media exists but has no compatible downloadable original leaves all existing inline utilities available and adds a localized result that says what failed, why it may have failed, and what the user can do next, with stable code `MEDIA_LOOKUP_FAILED` or `MEDIA_NOT_FOUND`. A valid text-only post uses the informational no-media wording defined above.
- The FxEmbed request necessarily discloses the public post identifier (and Bluesky handle) plus the bot server IP and User-Agent to the selected API service. Complete user query text and unrelated URLs are never sent.

## Acceptance

- Migration is tested from an untouched legacy three-table fixture, including large Telegram identifiers, Unicode, statuses, timestamps, settings, normal-message data, rollback, and idempotent rerun.
- Tests cover repository constraints and persistence, hide-message consumption and expiry, ClearURLs behavior and snapshot integrity, SSRF rejection, UTF-16 entity rebuilding, settings authorization, and replace/reply/off fallback behavior.
- Tests cover exact social-post URL recognition, fixed API endpoints, timeout/redirect/body limits, malformed and failed payloads, valid text-only X and Bluesky posts, quoted-post media isolation, incompatible top-level media, combined-image-first ordering, trusted FxTwitter mosaic selection without loss of originals, persisted default media-group/combine selection and administrator callbacks, compatible video selection, persistent default-on settings, UTF-16 profile/post link caption entities, native direct-message delivery, silent direct text-only handling, continued cleanup for changed text-only links, group replace deletion only after an actual replacement was sent, permission-denied retention and recovery, localized failure results, and real grammY inline-query output construction.
- Release validation includes build, full tests, database checks, a repository-wide forbidden-pattern audit, command-menu synchronization through the real grammY API method, and bot startup against a migrated database. Telegram live acceptance is reported separately and is never claimed without credentials and actual private/group requests.
