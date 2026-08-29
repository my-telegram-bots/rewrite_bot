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
    cleanup_enabled: 1, expand_short_urls: 0, remove_referral_marketing: 0,
  })
  expect(db.prepare('SELECT placeholder FROM user_hide_placeholders WHERE user_id = ? ORDER BY position').all('9007199254740993'))
    .toEqual([{ placeholder: '█' }, { placeholder: '疑問' }])
  expect(db.prepare('SELECT placeholder FROM user_hide_placeholders WHERE user_id = ? ORDER BY position').all('9007199254740994'))
    .toEqual([{ placeholder: '█' }, { placeholder: '❔' }, { placeholder: '❓' }])
  expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('hideMessage','hideNormalMessage','userSetting')").all())
    .toHaveLength(0)
  db.close()

  await expect(migrateDatabase(path)).resolves.toEqual({ migrated: false, version: 1 })
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
