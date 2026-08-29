import Database from 'better-sqlite3'
import { assertDatabaseCurrent, openDatabase } from './connection'
import { Repositories } from './repositories'

let connection: Database.Database | undefined
let repositories: Repositories | undefined

export function initializeDatabase(): Repositories {
  if (!connection) {
    connection = openDatabase(undefined, true)
    assertDatabaseCurrent(connection)
    repositories = new Repositories(connection)
  }
  return repositories as Repositories
}

export function dbRepositories(): Repositories {
  return repositories || initializeDatabase()
}

export function closeDatabase(): void {
  connection?.close()
  connection = undefined
  repositories = undefined
}

export * from './connection'
export * from './repositories'
export * from './types'
