import { cpSync, existsSync, mkdirSync } from 'fs'
import { resolve } from 'path'

export function copyAssets(): void {
  const appEntry = resolve('dist/src/app.js')
  if (!existsSync(appEntry)) throw new Error(`Compiled application entry is missing: ${appEntry}`)

  const destination = resolve('dist/src/db/migrations')
  mkdirSync(destination, { recursive: true })
  cpSync(resolve('src/db/migrations/001_canonical_schema.sql'), resolve(destination, '001_canonical_schema.sql'))
  cpSync(resolve('locales'), resolve('dist/locales'), { recursive: true })
}

if (require.main === module) copyAssets()
