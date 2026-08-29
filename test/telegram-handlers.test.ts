import { mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { migrateDatabase } from '../src/db/migrate'

// Exact owned temporary path; 64 MiB budget; removed before and after this suite.
const TEST_ROOT = '/tmp/rewrite-bot-telegram-handler-test'
const DB_PATH = join(TEST_ROOT, 'handler.db')
const cleanup = () => rmSync(TEST_ROOT, { recursive: true, force: true })

type ApiCall = { method: string; payload: Record<string, unknown> }
const calls: ApiCall[] = []
let memberStatus: 'member' | 'administrator' = 'member'

beforeAll(async () => {
  cleanup()
  mkdirSync(TEST_ROOT, { recursive: true })
  process.once('exit', cleanup)
  process.env.BOT_TOKEN = '1:test-token'
  process.env.DATABASE_PATH = DB_PATH
  await migrateDatabase(DB_PATH)

  const { initializeDatabase } = await import('../src/db')
  initializeDatabase()
  const { bot } = await import('../src/bot')
  bot.botInfo = {
    id: 1,
    is_bot: true,
    first_name: 'rewrite_bot',
    username: 'rewrite_bot_test',
    can_join_groups: true,
    can_read_all_group_messages: true,
    supports_inline_queries: true,
    can_connect_to_business: false,
    has_main_web_app: false,
    has_topics_enabled: false,
    allows_users_to_create_topics: false,
    can_manage_bots: false,
    supports_join_request_queries: false,
  }
  bot.api.config.use(async (_previous, method, payload) => {
    const capturedPayload = payload as Record<string, unknown>
    calls.push({ method, payload: capturedPayload })
    if (method === 'getChatMember') {
      return {
        ok: true,
        result: memberStatus === 'administrator'
          ? { status: 'administrator', user: { id: 7, is_bot: false, first_name: 'Admin' }, can_be_edited: false, is_anonymous: false, can_manage_chat: true, can_delete_messages: true, can_manage_video_chats: true, can_restrict_members: true, can_promote_members: false, can_change_info: true, can_invite_users: true, can_post_stories: false, can_edit_stories: false, can_delete_stories: false }
          : { status: 'member', user: { id: 7, is_bot: false, first_name: 'Member' } },
      } as never
    }
    if (method === 'sendMessage') {
      return { ok: true, result: { message_id: 99, date: 1, chat: { id: capturedPayload.chat_id, type: 'private' }, text: capturedPayload.text } } as never
    }
    return { ok: true, result: true } as never
  })
  await import('../src/commands/index')
  await import('../src/inline/index')
  await import('../src/callback/index')
})

afterAll(async () => {
  const { closeDatabase } = await import('../src/db')
  closeDatabase()
  process.removeListener('exit', cleanup)
  cleanup()
})

beforeEach(() => {
  calls.length = 0
  memberStatus = 'member'
})

test('private /settings renders localized stable panel and callback persists through grammY', async () => {
  const { bot } = await import('../src/bot')
  const { dbRepositories } = await import('../src/db')
  await bot.handleUpdate({
    update_id: 1,
    message: {
      message_id: 10, date: 1, text: '/settings',
      entities: [{ type: 'bot_command', offset: 0, length: 9 }],
      chat: { id: 7, type: 'private', first_name: '测试' },
      from: { id: 7, is_bot: false, first_name: '测试', language_code: 'zh-CN' },
    },
  })
  const panelCall = calls.find(({ method }) => method === 'sendMessage')!
  expect(panelCall.payload.text).toContain('个人设置')
  expect(panelCall.payload.text).toContain('联网展开短链: 开')
  expect((panelCall.payload.reply_markup as { inline_keyboard: unknown[][] }).inline_keyboard.map((row) => row.length))
    .toEqual([1, 1, 1, 1])

  calls.length = 0
  await bot.handleUpdate({
    update_id: 2,
    callback_query: {
      id: 'callback-private', data: 'settings:u:short',
      from: { id: 7, is_bot: false, first_name: '测试', language_code: 'zh-CN' },
      chat_instance: 'private',
      message: { message_id: 11, date: 1, text: 'panel', chat: { id: 7, type: 'private', first_name: '测试' } },
    },
  })
  expect(calls.map(({ method }) => method)).toEqual(['editMessageText', 'answerCallbackQuery'])
  expect(dbRepositories().getOrCreateUserSettings('7').expandShortUrls).toBe(false)
})

test('group callback rechecks administrator status before every mutation', async () => {
  const { bot } = await import('../src/bot')
  const { dbRepositories } = await import('../src/db')
  const update = (id: number) => ({
    update_id: id,
    callback_query: {
      id: `callback-${id}`, data: 'settings:g:mode:reply',
      from: { id: 7, is_bot: false, first_name: 'Member', language_code: 'en' },
      chat_instance: 'group',
      message: { message_id: 20, date: 1, text: 'panel', chat: { id: -100, type: 'supergroup', title: 'Test' } },
    },
  } as const)

  await bot.handleUpdate(update(3))
  expect(calls.map(({ method }) => method)).toEqual(['getChatMember', 'answerCallbackQuery'])
  expect(calls.at(-1)?.payload.text).toContain('SETTINGS_ADMIN_REQUIRED')
  expect(dbRepositories().getOrCreateChatSettings('-100').mode).toBe('replace')

  calls.length = 0
  memberStatus = 'administrator'
  await bot.handleUpdate(update(4))
  expect(calls.map(({ method }) => method)).toEqual(['getChatMember', 'editMessageText', 'answerCallbackQuery'])
  expect(dbRepositories().getOrCreateChatSettings('-100').mode).toBe('reply')
})

test('inline query returns cleaned URL output through the grammY pipeline', async () => {
  const { bot } = await import('../src/bot')
  await bot.handleUpdate({
    update_id: 5,
    inline_query: {
      id: 'inline-1', offset: '', query: 'https://example.com/x?utm_source=test',
      from: { id: 8, is_bot: false, first_name: 'Inline', language_code: 'en' },
    },
  })
  const answer = calls.find(({ method }) => method === 'answerInlineQuery')!
  const results = answer.payload.results as Array<{ id: string; input_message_content: { message_text: string } }>
  expect(results.find(({ id }) => id === 'clean-url')?.input_message_content.message_text)
    .toBe('https://example.com/x')
})

test('message beginning with the bot zero-width marker bypasses URL cleanup', async () => {
  const { bot } = await import('../src/bot')
  const markedUrl = '\u200Chttps://example.com/x?utm_source=test'
  await bot.handleUpdate({
    update_id: 6,
    message: {
      message_id: 30, date: 1, text: markedUrl,
      entities: [{ type: 'url', offset: 1, length: markedUrl.length - 1 }],
      chat: { id: 9, type: 'private', first_name: 'Marked' },
      from: { id: 9, is_bot: false, first_name: 'Marked', language_code: 'en' },
    },
  })
  expect(calls).toEqual([])
})
