import { databasePath } from './connection'
import { migrateDatabase } from './migrate'

migrateDatabase(databasePath()).then((result) => {
  console.log(JSON.stringify(result, null, 2))
}).catch((error) => {
  console.error(error)
  process.exitCode = 1
})
