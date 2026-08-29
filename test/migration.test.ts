import Database from 'better-sqlite3'
import { existsSync, rmSync } from 'fs'
import { join } from 'path'
import { migrateDatabase } from '../src/db/migrate'

// Exact owned temporary path; 64 MiB budget; removed before and after this suite.
const TEST_ROOT = '/tmp/rewrite-bot-migration-test'
const cleanup = () => rmSync(TEST_ROOT, { recursive: true, force: true })

function createLegacyDatabase(path: string, invalidPlaceholders = false): void {
  const db = new Database(path)
  db.exec(`
    CREATE TABLE hideMessage (
      id TEXT PRIMARY KEY, user_id BIGINT NOT NULL, text TEXT NOT NULL DEFAULT '',
      count INTEGER NOT NULL DEFAULT 0, max_count INTEGER NOT NULL DEFAULT 0,
      status INTEGER NOT NULL DEFAULT 0, time BIGINT NOT NULL, expired_time BIGINT NOT NULL DEFAULT 0
    );
    CREATE TABLE hideNormalMessage (
      id TEXT PRIMARY KEY, user_id BIGINT NOT NULL, message_id BIGINT NOT NULL,
      message_type INTEGER NOT NULL DEFAULT 1, text TEXT NOT NULL DEFAULT '', time BIGINT NOT NULL
    );
    CREATE TABLE userSetting (
      user_id BIGINT UNIQUE NOT NULL, hide_placeholders TEXT NOT NULL DEFAULT '',
      hide_mode INTEGER NOT NULL DEFAULT 1, disabled TEXT NOT NULL DEFAULT '', expired_time_offset INTEGER NOT NULL DEFAULT 0
    );
    INSERT INTO hideMessage VALUES
      ('hidden-1', 9007199254740993, '秘密 😀\n第二行', 2, 5, 1, 1700000000, 1800000000);
    INSERT INTO hideNormalMessage VALUES
      ('normal-1', 9007199254740994, 9007199254740995, 7, '旧 message-mode 文本', 1700000001),
      ('normal-duplicate', 9007199254740994, 9007199254740995, 8, '重复键也必须保留', 1700000002);
  `)
  db.prepare('INSERT INTO userSetting VALUES (9007199254740993, ?, 2, ?, 3600)').run(
    invalidPlaceholders ? '{broken-json' : '["█","疑問"]',
    'legacy-disabled-value',
  )
  db.close()
}

beforeAll(() => {
  cleanup()
  require('fs').mkdirSync(TEST_ROOT, { recursive: true })
  process.once('exit', cleanup)
})

afterAll(() => {
  process.removeListener('exit', cleanup)
  cleanup()
})

test('migrates all legacy data exactly, creates a backup, and is idempotent', async () => {
  const path = join(TEST_ROOT, 'legacy.db')
  createLegacyDatabase(path)
  const result = await migrateDatabase(path)
  expect(result.migrated).toBe(true)
  expect(result.backupPath && existsSync(result.backupPath)).toBe(true)
  const backup = new Database(result.backupPath as string, { readonly: true })
  expect(backup.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='hideMessage'").get()).toBeTruthy()
  expect(backup.prepare('SELECT text FROM hideMessage WHERE id = ?').get('hidden-1')).toEqual({ text: '秘密 😀\n第二行' })
  backup.close()

  const db = new Database(path)
  const hidden = db.prepare('SELECT * FROM hidden_messages').get() as Record<string, unknown>
  expect(hidden).toMatchObject({
    id: 'hidden-1', user_id: '9007199254740993', text: '秘密 😀\n第二行',
    count: 2, max_count: 5, status: 1, time: 1700000000, expired_time: 1800000000,
  })
  expect(db.prepare('SELECT * FROM hidden_normal_messages WHERE id = ?').get('normal-1')).toMatchObject({
    id: 'normal-1', user_id: '9007199254740994', message_id: '9007199254740995',
    message_type: 7, text: '旧 message-mode 文本', time: 1700000001,
  })
  expect(db.prepare('SELECT COUNT(*) AS count FROM hidden_normal_messages').get()).toEqual({ count: 2 })
  expect(db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get('9007199254740993')).toMatchObject({
    hide_mode: 2, hide_disabled: 'legacy-disabled-value', expired_time_offset: 3600,
    cleanup_enabled: 1, expand_short_urls: 1, remove_referral_marketing: 0,
    social_media_enabled: 1,
    multi_image_mode: 'media_group',
  })
  expect(db.prepare('SELECT placeholder FROM user_hide_placeholders WHERE user_id = ? ORDER BY position').all('9007199254740993'))
    .toEqual([{ placeholder: '█' }, { placeholder: '疑問' }])
  expect(db.prepare('SELECT placeholder FROM user_hide_placeholders WHERE user_id = ? ORDER BY position').all('9007199254740994'))
    .toEqual([{ placeholder: '█' }, { placeholder: '❔' }, { placeholder: '❓' }])
  expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('hideMessage','hideNormalMessage','userSetting')").all())
    .toHaveLength(0)
  expect(db.prepare('SELECT version FROM schema_migrations ORDER BY version').all())
    .toEqual([{ version: 1 }, { version: 2 }, { version: 3 }, { version: 4 }])
  db.close()

  await expect(migrateDatabase(path)).resolves.toEqual({ migrated: false, version: 4 })
})

test('upgrades v1 defaults without overwriting existing short-link choices', async () => {
  const path = join(TEST_ROOT, 'canonical-v1.db')
  const db = new Database(path)
  const migrationV1 = require('fs').readFileSync(
    join(__dirname, '..', 'src', 'db', 'migrations', '001_canonical_schema.sql'),
    'utf8',
  ) as string
  db.exec(migrationV1)
  db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (1, ?, ?)')
    .run('canonical_sqlite_v1', '2026-08-29T00:00:00.000Z')
  db.prepare('INSERT INTO user_settings (user_id, expand_short_urls) VALUES (?, ?)').run('10', 0)
  db.prepare('INSERT INTO user_settings (user_id, expand_short_urls) VALUES (?, ?)').run('11', 1)
  db.prepare('INSERT INTO user_hide_placeholders VALUES (?, ?, ?)').run('10', 0, '█')
  db.prepare('INSERT INTO chat_settings (chat_id, expand_short_urls) VALUES (?, ?)').run('-10', 0)
  db.close()

  await expect(migrateDatabase(path)).resolves.toMatchObject({ migrated: true, version: 4 })
  const upgraded = new Database(path)
  expect(upgraded.prepare('SELECT user_id, expand_short_urls FROM user_settings ORDER BY user_id').all())
    .toEqual([
      { user_id: '10', expand_short_urls: 0 },
      { user_id: '11', expand_short_urls: 1 },
    ])
  expect(upgraded.prepare('SELECT placeholder FROM user_hide_placeholders WHERE user_id = ?').all('10'))
    .toEqual([{ placeholder: '█' }])
  expect(upgraded.prepare('SELECT expand_short_urls FROM chat_settings WHERE chat_id = ?').get('-10'))
    .toEqual({ expand_short_urls: 0 })
  upgraded.prepare('INSERT INTO user_settings (user_id) VALUES (?)').run('12')
  upgraded.prepare('INSERT INTO chat_settings (chat_id) VALUES (?)').run('-12')
  expect(upgraded.prepare('SELECT expand_short_urls FROM user_settings WHERE user_id = ?').get('12'))
    .toEqual({ expand_short_urls: 1 })
  expect(upgraded.prepare('SELECT expand_short_urls FROM chat_settings WHERE chat_id = ?').get('-12'))
    .toEqual({ expand_short_urls: 1 })
  expect(upgraded.prepare('SELECT user_id, social_media_enabled FROM user_settings ORDER BY user_id').all())
    .toEqual([
      { user_id: '10', social_media_enabled: 1 },
      { user_id: '11', social_media_enabled: 1 },
      { user_id: '12', social_media_enabled: 1 },
    ])
  expect(upgraded.prepare('SELECT chat_id, social_media_enabled FROM chat_settings ORDER BY chat_id').all())
    .toEqual([
      { chat_id: '-10', social_media_enabled: 1 },
      { chat_id: '-12', social_media_enabled: 1 },
    ])
  expect(upgraded.prepare('SELECT user_id, multi_image_mode FROM user_settings ORDER BY user_id').all())
    .toEqual([
      { user_id: '10', multi_image_mode: 'media_group' },
      { user_id: '11', multi_image_mode: 'media_group' },
      { user_id: '12', multi_image_mode: 'media_group' },
    ])
  expect(upgraded.prepare('SELECT chat_id, multi_image_mode FROM chat_settings ORDER BY chat_id').all())
    .toEqual([
      { chat_id: '-10', multi_image_mode: 'media_group' },
      { chat_id: '-12', multi_image_mode: 'media_group' },
    ])
  upgraded.close()
})

test('rolls back the schema switch when legacy normalization fails', async () => {
  const path = join(TEST_ROOT, 'rollback.db')
  createLegacyDatabase(path, true)
  await expect(migrateDatabase(path)).rejects.toThrow('hide_placeholders')
  const db = new Database(path)
  expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='hideMessage'").get()).toBeTruthy()
  expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='hidden_messages'").get()).toBeUndefined()
  db.close()
})

test('upgrades v3 settings to default media-group mode without changing existing choices', async () => {
  const path = join(TEST_ROOT, 'canonical-v3.db')
  const db = new Database(path)
  for (const [version, name] of [
    [1, 'canonical_sqlite_v1'],
    [2, 'short_links_default_on'],
    [3, 'social_media_default_on'],
  ] as const) {
    const sql = require('fs').readFileSync(
      join(__dirname, '..', 'src', 'db', 'migrations', `00${version}_${[
        'canonical_schema', 'short_links_default_on', 'social_media_default_on',
      ][version - 1]}.sql`),
      'utf8',
    ) as string
    db.exec(sql)
    db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
      .run(version, name, `2026-08-29T00:00:0${version}.000Z`)
  }
  db.prepare(`
    INSERT INTO user_settings
      (user_id, cleanup_enabled, expand_short_urls, remove_referral_marketing, social_media_enabled, hide_mode)
    VALUES ('30', 0, 0, 1, 0, 2)
  `).run()
  db.prepare('INSERT INTO user_hide_placeholders VALUES (?, ?, ?)').run('30', 0, '秘')
  db.prepare(`
    INSERT INTO chat_settings
      (chat_id, cleanup_enabled, expand_short_urls, remove_referral_marketing, social_media_enabled, mode)
    VALUES ('-30', 0, 0, 1, 0, 'off')
  `).run()
  db.close()

  await expect(migrateDatabase(path)).resolves.toMatchObject({ migrated: true, version: 4 })
  const upgraded = new Database(path)
  expect(upgraded.prepare('SELECT * FROM user_settings WHERE user_id = ?').get('30')).toMatchObject({
    cleanup_enabled: 0, expand_short_urls: 0, remove_referral_marketing: 1,
    social_media_enabled: 0, hide_mode: 2, multi_image_mode: 'media_group',
  })
  expect(upgraded.prepare('SELECT * FROM chat_settings WHERE chat_id = ?').get('-30')).toMatchObject({
    cleanup_enabled: 0, expand_short_urls: 0, remove_referral_marketing: 1,
    social_media_enabled: 0, mode: 'off', multi_image_mode: 'media_group',
  })
  upgraded.close()
})
