import { mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { migrateDatabase } from '../src/db/migrate'
import { assertDatabaseCurrent, openDatabase } from '../src/db/connection'
import { Repositories, telegramId } from '../src/db/repositories'

// Exact owned temporary path; 64 MiB budget; removed before and after this suite.
const TEST_ROOT = '/tmp/rewrite-bot-repository-test'
const DB_PATH = join(TEST_ROOT, 'repository.db')
const cleanup = () => rmSync(TEST_ROOT, { recursive: true, force: true })

beforeAll(async () => {
  cleanup()
  mkdirSync(TEST_ROOT, { recursive: true })
  process.once('exit', cleanup)
  await migrateDatabase(DB_PATH)
})

test('startup rejects a database whose explicit migration has not run', () => {
  const db = openDatabase(':memory:')
  expect(() => assertDatabaseCurrent(db)).toThrow('db:migrate')
  db.close()
})

afterAll(() => {
  process.removeListener('exit', cleanup)
  cleanup()
})

test('upserts defaults, validates IDs, rolls back bad patches, and persists settings after restart', () => {
  let db = openDatabase(DB_PATH, true)
  let repositories = new Repositories(db)
  const initial = repositories.getOrCreateUserSettings('90071992547409931')
  expect(initial).toMatchObject({
    userId: '90071992547409931', cleanupEnabled: true, expandShortUrls: true,
    removeReferralMarketing: false, hidePlaceholders: ['█', '❔', '❓'],
  })
  repositories.getOrCreateUserSettings('90071992547409931')
  expect(() => repositories.updateUserSettings('90071992547409931', { hidePlaceholders: [] })).toThrow()
  expect(repositories.getOrCreateUserSettings('90071992547409931').hidePlaceholders).toEqual(['█', '❔', '❓'])
  repositories.updateUserSettings('90071992547409931', {
    cleanupEnabled: false,
    expandShortUrls: true,
    removeReferralMarketing: true,
    hideMode: 2,
    hidePlaceholders: ['秘'],
  })
  expect(repositories.getOrCreateChatSettings('-1001234567890123')).toMatchObject({
    mode: 'replace', cleanupEnabled: true, expandShortUrls: true,
  })
  repositories.updateChatSettings('-1001234567890123', { mode: 'reply', expandShortUrls: false })
  db.close()

  db = openDatabase(DB_PATH, true)
  repositories = new Repositories(db)
  expect(repositories.getOrCreateUserSettings('90071992547409931')).toMatchObject({
    cleanupEnabled: false, expandShortUrls: true, removeReferralMarketing: true,
    hideMode: 2, hidePlaceholders: ['秘'],
  })
  expect(repositories.getOrCreateChatSettings('-1001234567890123')).toMatchObject({ mode: 'reply', expandShortUrls: false })
  repositories.createHiddenNormalMessage({
    id: 'normal-created', userId: '90071992547409931', messageId: '90071992547409932',
    messageType: 2, text: 'persist me', time: 123,
  })
  expect(repositories.getHiddenNormalMessage('90071992547409931', '90071992547409932')).toMatchObject({
    id: 'normal-created', messageType: 2, text: 'persist me',
  })
  db.close()
  expect(() => telegramId(Number.MAX_SAFE_INTEGER + 1)).toThrow('unsafe')
})

test('consumes atomically, enforces expiry/read limits, and garbage-collects terminal rows', () => {
  const db = openDatabase(DB_PATH, true)
  const repositories = new Repositories(db)
  repositories.createHiddenMessage({ id: 'limited', userId: '1', text: 'secret', maxCount: 1, time: 100 })
  expect(repositories.consumeHiddenMessage('limited', 101)).toMatchObject({ state: 'ok', message: { count: 1 } })
  expect(repositories.consumeHiddenMessage('limited', 102)).toEqual({ state: 'exhausted' })
  repositories.createHiddenMessage({ id: 'expired', userId: '1', text: 'old', expiredTime: 100, time: 90 })
  expect(repositories.consumeHiddenMessage('expired', 100)).toEqual({ state: 'expired' })
  repositories.createHiddenMessage({ id: 'stale', userId: '1', text: 'never sent', time: 1 })
  expect(repositories.cleanupHiddenMessages(1000)).toBe(3)
  expect(repositories.consumeHiddenMessage('limited', 1001)).toEqual({ state: 'missing' })
  db.close()
})
