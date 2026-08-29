import { Bot } from 'grammy'
import { synchronizeCommandMenus } from '../src/commands/menu'

test('startup fills localized private and group Telegram command menus', async () => {
  const calls: Array<{ method: string; payload: Record<string, unknown> }> = []
  const bot = new Bot('1:test-token')
  bot.api.config.use(async (_previous, method, payload) => {
    calls.push({ method, payload: payload as Record<string, unknown> })
    return { ok: true, result: true } as never
  })
  await synchronizeCommandMenus(bot.api)

  expect(calls.map(({ method }) => method)).toEqual([
    'setMyCommands', 'setMyCommands', 'setMyCommands', 'setMyCommands',
  ])
  expect(calls[0].payload).toEqual({
    commands: [
      { command: 'start', description: 'Open rewrite bot and show help' },
      { command: 'settings', description: 'Configure persistent bot settings' },
      { command: 'clean', description: 'Delete your stored hidden messages' },
      { command: 'id', description: 'Show this chat and user ID' },
    ],
    scope: { type: 'all_private_chats' },
  })
  expect(calls[1].payload).toEqual({
    commands: [
      { command: 'settings', description: 'Configure persistent bot settings' },
      { command: 'id', description: 'Show this chat and user ID' },
    ],
    scope: { type: 'all_group_chats' },
  })
  expect(calls[2].payload.commands).toEqual([
    { command: 'start', description: '打开 rewrite bot 并查看帮助' },
    { command: 'settings', description: '配置持久化 bot 设置' },
    { command: 'clean', description: '删除你存储的隐藏消息' },
    { command: 'id', description: '查看当前聊天和用户 ID' },
  ])
  expect(calls[2].payload).toMatchObject({ scope: { type: 'all_private_chats' }, language_code: 'zh' })
  expect((calls[3].payload.commands as Array<{ command: string }>)
    .map(({ command }) => command)).toEqual(['settings', 'id'])
  expect(calls[3].payload).toMatchObject({ scope: { type: 'all_group_chats' }, language_code: 'zh' })
})
