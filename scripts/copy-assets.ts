import { cpSync, mkdirSync } from 'fs'
import { resolve } from 'path'

const destination = resolve('dist/db/migrations')
mkdirSync(destination, { recursive: true })
cpSync(resolve('src/db/migrations/001_canonical_schema.sql'), resolve(destination, '001_canonical_schema.sql'))
cpSync(resolve('locales'), resolve('dist/locales'), { recursive: true })
