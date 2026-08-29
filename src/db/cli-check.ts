import { assertDatabaseCurrent, checkDatabase, databasePath, openDatabase } from './connection'

const db = openDatabase(databasePath(), true)
try {
  assertDatabaseCurrent(db)
  checkDatabase(db)
  console.log(`Database check passed: ${databasePath()}`)
} finally {
  db.close()
}
