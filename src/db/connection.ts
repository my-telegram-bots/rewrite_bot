import Database from 'better-sqlite3'
import { existsSync } from 'fs'
import { resolve } from 'path'

export const LATEST_SCHEMA_VERSION = 4

export function databasePath(): string {
  return resolve(process.env.DATABASE_PATH || './data/rewrite_bot.db')
}

export function openDatabase(path = databasePath(), requireExisting = false): Database.Database {
  if (requireExisting && !existsSync(path)) {
    throw new Error(`Database does not exist: ${path}. Run yarn db:migrate first.`)
  }
  const db = new Database(path)
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = FULL')
  return db
}

export function assertDatabaseCurrent(db: Database.Database): void {
  const table = db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'",
  ).get()
  if (!table) {
    throw new Error('Database schema is not initialized. Run yarn db:migrate before starting the bot.')
  }
  const row = db.prepare('SELECT MAX(version) AS version FROM schema_migrations').get() as {
    version: number | null
  }
  if (row.version !== LATEST_SCHEMA_VERSION) {
    throw new Error(
      `Database schema version ${row.version ?? 'none'} is not supported; expected ${LATEST_SCHEMA_VERSION}. Run yarn db:migrate.`,
    )
  }
  const requiredTables = [
    'hidden_messages',
    'hidden_normal_messages',
    'user_settings',
    'user_hide_placeholders',
    'chat_settings',
    'schema_migrations',
  ]
  const present = new Set((db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>)
    .map(({ name }) => name))
  const missing = requiredTables.filter((name) => !present.has(name))
  if (missing.length > 0) throw new Error(`Database schema is incomplete; missing: ${missing.join(', ')}`)
  const legacy = ['hideMessage', 'hideNormalMessage', 'userSetting'].filter((name) => present.has(name))
  if (legacy.length > 0) throw new Error(`Legacy tables remain after migration: ${legacy.join(', ')}`)
}

export function checkDatabase(db: Database.Database): void {
  const integrity = db.pragma('integrity_check') as Array<{ integrity_check: string }>
  if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok') {
    throw new Error(`SQLite integrity_check failed: ${JSON.stringify(integrity)}`)
  }
  const foreignKeys = db.pragma('foreign_key_check') as unknown[]
  if (foreignKeys.length !== 0) {
    throw new Error(`SQLite foreign_key_check failed: ${JSON.stringify(foreignKeys)}`)
  }
}
