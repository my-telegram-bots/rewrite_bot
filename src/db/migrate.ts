import Database from 'better-sqlite3'
import { existsSync, mkdirSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { assertDatabaseCurrent, checkDatabase, LATEST_SCHEMA_VERSION, openDatabase } from './connection'
import { DEFAULT_HIDE_PLACEHOLDERS } from './types'

const migrationSql = readFileSync(join(__dirname, 'migrations', '001_canonical_schema.sql'), 'utf8')
const LEGACY_TABLES = ['hideMessage', 'hideNormalMessage', 'userSetting'] as const

export interface MigrationResult {
  migrated: boolean
  backupPath?: string
  version: number
}

function tableExists(db: Database.Database, name: string): boolean {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name))
}

function currentVersion(db: Database.Database): number | undefined {
  if (!tableExists(db, 'schema_migrations')) return undefined
  const row = db.prepare('SELECT MAX(version) AS version FROM schema_migrations').get() as {
    version: number | null
  }
  return row.version ?? undefined
}

function backupName(path: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  let candidate = `${path}.backup-${stamp}`
  let suffix = 1
  while (existsSync(candidate)) candidate = `${path}.backup-${stamp}-${suffix++}`
  return candidate
}

function parsePlaceholders(raw: string): string[] {
  if (!raw) return [...DEFAULT_HIDE_PLACEHOLDERS]
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new Error(`Legacy hide_placeholders is invalid JSON: ${String(error)}`)
  }
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string' || item.length === 0)) {
    throw new Error('Legacy hide_placeholders is not an array of non-empty strings')
  }
  return parsed.length ? parsed : [...DEFAULT_HIDE_PLACEHOLDERS]
}

function copyLegacyData(db: Database.Database): void {
  const legacyCount = {
    hidden: (db.prepare('SELECT COUNT(*) AS count FROM hideMessage').get() as { count: number }).count,
    normal: (db.prepare('SELECT COUNT(*) AS count FROM hideNormalMessage').get() as { count: number }).count,
    settings: (db.prepare('SELECT COUNT(*) AS count FROM userSetting').get() as { count: number }).count,
  }

  db.exec(`
    INSERT INTO hidden_messages (id, user_id, text, count, max_count, status, time, expired_time)
    SELECT id, CAST(user_id AS TEXT), text, count, max_count, status, time, expired_time FROM hideMessage;

    INSERT INTO hidden_normal_messages (id, user_id, message_id, message_type, text, time)
    SELECT id, CAST(user_id AS TEXT), CAST(message_id AS TEXT), message_type, text, time FROM hideNormalMessage;

    INSERT INTO user_settings (user_id, hide_mode, hide_disabled, expired_time_offset)
    SELECT CAST(user_id AS TEXT), hide_mode, disabled, expired_time_offset FROM userSetting;

    INSERT OR IGNORE INTO user_settings (user_id)
    SELECT CAST(user_id AS TEXT) FROM hideMessage;

    INSERT OR IGNORE INTO user_settings (user_id)
    SELECT CAST(user_id AS TEXT) FROM hideNormalMessage;
  `)

  const legacySettings = db.prepare(
    'SELECT CAST(user_id AS TEXT) AS user_id, hide_placeholders FROM userSetting',
  ).all() as Array<{ user_id: string; hide_placeholders: string }>
  const insertPlaceholder = db.prepare(`
    INSERT INTO user_hide_placeholders (user_id, position, placeholder) VALUES (?, ?, ?)
  `)
  const usersWithLegacySettings = new Set<string>()
  let expectedPlaceholderCount = 0
  for (const row of legacySettings) {
    usersWithLegacySettings.add(row.user_id)
    const placeholders = parsePlaceholders(row.hide_placeholders)
    expectedPlaceholderCount += placeholders.length
    placeholders.forEach((placeholder, position) => {
      insertPlaceholder.run(row.user_id, position, placeholder)
    })
  }
  const allUsers = db.prepare('SELECT user_id FROM user_settings').all() as Array<{ user_id: string }>
  for (const { user_id: userId } of allUsers) {
    if (!usersWithLegacySettings.has(userId)) {
      expectedPlaceholderCount += DEFAULT_HIDE_PLACEHOLDERS.length
      DEFAULT_HIDE_PLACEHOLDERS.forEach((placeholder, position) => {
        insertPlaceholder.run(userId, position, placeholder)
      })
    }
  }

  const canonicalCount = {
    hidden: (db.prepare('SELECT COUNT(*) AS count FROM hidden_messages').get() as { count: number }).count,
    normal: (db.prepare('SELECT COUNT(*) AS count FROM hidden_normal_messages').get() as { count: number }).count,
    settings: (db.prepare('SELECT COUNT(*) AS count FROM user_settings').get() as { count: number }).count,
  }
  if (canonicalCount.hidden !== legacyCount.hidden || canonicalCount.normal !== legacyCount.normal) {
    throw new Error(`Legacy row-count validation failed: ${JSON.stringify({ legacyCount, canonicalCount })}`)
  }
  if (canonicalCount.settings < legacyCount.settings) {
    throw new Error(`Legacy settings row-count validation failed: ${JSON.stringify({ legacyCount, canonicalCount })}`)
  }
  const placeholderCount = (db.prepare(
    'SELECT COUNT(*) AS count FROM user_hide_placeholders',
  ).get() as { count: number }).count
  if (placeholderCount !== expectedPlaceholderCount) {
    throw new Error(`Legacy placeholder-count validation failed: expected ${expectedPlaceholderCount}, got ${placeholderCount}`)
  }

  db.exec('DROP TABLE hideMessage; DROP TABLE hideNormalMessage; DROP TABLE userSetting;')
}

export async function migrateDatabase(path: string): Promise<MigrationResult> {
  const existed = existsSync(path)
  mkdirSync(dirname(path), { recursive: true })
  const db = openDatabase(path)
  try {
    checkDatabase(db)
    const version = currentVersion(db)
    if (version === LATEST_SCHEMA_VERSION) {
      assertDatabaseCurrent(db)
      return { migrated: false, version }
    }
    if (version !== undefined) {
      throw new Error(`Unsupported schema migration path from version ${version}`)
    }

    const presentLegacyTables = LEGACY_TABLES.filter((name) => tableExists(db, name))
    if (presentLegacyTables.length !== 0 && presentLegacyTables.length !== LEGACY_TABLES.length) {
      throw new Error(`Incomplete legacy schema: found ${presentLegacyTables.join(', ')}`)
    }

    let backupPath: string | undefined
    if (existed) {
      backupPath = backupName(path)
      await db.backup(backupPath)
    }

    const migrate = db.transaction(() => {
      db.exec(migrationSql)
      if (presentLegacyTables.length === LEGACY_TABLES.length) copyLegacyData(db)
      db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(
        LATEST_SCHEMA_VERSION,
        'canonical_sqlite_v1',
        new Date().toISOString(),
      )
      checkDatabase(db)
    })
    migrate()
    assertDatabaseCurrent(db)
    checkDatabase(db)
    return { migrated: true, backupPath, version: LATEST_SCHEMA_VERSION }
  } finally {
    db.close()
  }
}
