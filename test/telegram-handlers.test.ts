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

test('inline query resolves a Bluesky post into native downloadable media before link utilities', async () => {
  const originalFetch = global.fetch
  const fetchMock = jest.fn(async () => new Response(JSON.stringify({
    code: 200,
    status: {
      type: 'status', provider: 'bluesky', url: 'https://bsky.app/profile/bsky.app/post/3l3vgf77uco2g',
      text: '帖子 😀', author: { name: 'Bluesky', screen_name: 'bsky.app' },
      media: { all: [{
        type: 'video', format: 'video/mp4',
        url: 'https://pds-cache.fxbsky.app/video',
        thumbnail_url: 'https://video.bsky.app/thumb.jpg', width: 1920, height: 1080, duration: 3,
        formats: [{ container: 'mp4', codec: 'h264', url: 'https://pds-cache.fxbsky.app/video' }],
      }] },
    },
  }), { headers: { 'content-type': 'application/json' } }))
  global.fetch = fetchMock as typeof fetch
  try {
    const { bot } = await import('../src/bot')
    await bot.handleUpdate({
      update_id: 7,
      inline_query: {
        id: 'inline-media', offset: '', query: '😀 https://bsky.app/profile/bsky.app/post/3l3vgf77uco2g',
        from: { id: 10, is_bot: false, first_name: 'Media', language_code: 'zh-CN' },
      },
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.fxbsky.app/2/status/bsky.app/3l3vgf77uco2g',
      expect.objectContaining({ method: 'GET', redirect: 'error' }),
    )
    const answer = calls.find(({ method }) => method === 'answerInlineQuery')!
    const results = answer.payload.results as Array<Record<string, unknown>>
    expect(results[0]).toMatchObject({
      id: 'media-video-1', type: 'video', video_url: 'https://pds-cache.fxbsky.app/video',
      mime_type: 'video/mp4', title: '下载视频 1/1',
    })
    expect((results[0].caption as string).startsWith('\u200C')).toBe(true)
    expect(results[1]).toMatchObject({ id: 'fxbluesky-link', type: 'article', title: '通过 fxbsky 发送' })
    expect(results[1].input_message_content).toMatchObject({
      message_text: expect.stringMatching(/^\u200C/),
      entities: [{
        type: 'text_link', offset: 0, length: 1,
        url: 'https://fxbsky.app/profile/bsky.app/post/3l3vgf77uco2g',
      }],
    })
  } finally {
    global.fetch = originalFetch
  }
})

test('mixed-text Twitter inline variants begin with the one processed marker', async () => {
  const originalFetch = global.fetch
  global.fetch = jest.fn(async () => new Response(JSON.stringify({
    code: 200,
    status: {
      type: 'status', provider: 'twitter', text: 'no media',
      media: { all: [] },
    },
  }), { headers: { 'content-type': 'application/json' } })) as typeof fetch
  try {
    const { bot } = await import('../src/bot')
    await bot.handleUpdate({
      update_id: 8,
      inline_query: {
        id: 'inline-twitter-marker', offset: '', query: 'look 😀 https://x.com/user/status/1234567890',
        from: { id: 11, is_bot: false, first_name: 'Marker', language_code: 'en' },
      },
    })
    const answer = calls.find(({ method }) => method === 'answerInlineQuery')!
    const results = answer.payload.results as Array<{
      id: string
      input_message_content: { message_text: string }
    }>
    expect(results.find(({ id }) => id === 'fxtwitter-link')?.input_message_content.message_text.startsWith('\u200C'))
      .toBe(true)
    expect(results.find(({ id }) => id === 'vxtwitter-link')?.input_message_content.message_text.startsWith('\u200C'))
      .toBe(true)
  } finally {
    global.fetch = originalFetch
  }
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

test('inline query beginning with the bot zero-width marker also bypasses URL cleanup', async () => {
  const { bot } = await import('../src/bot')
  const markedUrl = '\u200Chttps://example.com/x?utm_source=test'
  await bot.handleUpdate({
    update_id: 9,
    inline_query: {
      id: 'inline-marked', offset: '', query: markedUrl,
      from: { id: 12, is_bot: false, first_name: 'Marked', language_code: 'en' },
    },
  })
  const answer = calls.find(({ method }) => method === 'answerInlineQuery')!
  const results = answer.payload.results as Array<{ id: string; input_message_content: { message_text: string } }>
  expect(results.find(({ id }) => id === 'clean-url')).toBeUndefined()
  expect(results.find(({ id }) => id === 'split-character')?.input_message_content.message_text)
    .toContain('u t m _ s o u r c e = t e s t')
})
