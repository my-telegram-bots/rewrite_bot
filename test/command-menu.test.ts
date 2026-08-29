import { synchronizeCommandMenus } from '../src/commands/menu'

test('startup fills localized private and group Telegram command menus', async () => {
  const setMyCommands = jest.fn<Promise<true>, [unknown, unknown]>(async () => true as const)
  await synchronizeCommandMenus({ setMyCommands } as never)

  expect(setMyCommands).toHaveBeenCalledTimes(4)
  expect(setMyCommands.mock.calls[0]).toEqual([
    [
      { command: 'start', description: 'Open rewrite bot and show help' },
      { command: 'settings', description: 'Configure persistent bot settings' },
      { command: 'clean', description: 'Delete your stored hidden messages' },
      { command: 'id', description: 'Show this chat and user ID' },
    ],
    { scope: { type: 'all_private_chats' } },
  ])
  expect(setMyCommands.mock.calls[1]).toEqual([
    [
      { command: 'settings', description: 'Configure persistent bot settings' },
      { command: 'id', description: 'Show this chat and user ID' },
    ],
    { scope: { type: 'all_group_chats' } },
  ])
  expect(setMyCommands.mock.calls[2][0]).toEqual([
    { command: 'start', description: '打开 rewrite bot 并查看帮助' },
    { command: 'settings', description: '配置持久化 bot 设置' },
    { command: 'clean', description: '删除你存储的隐藏消息' },
    { command: 'id', description: '查看当前聊天和用户 ID' },
  ])
  expect(setMyCommands.mock.calls[2][1]).toEqual({ scope: { type: 'all_private_chats' }, language_code: 'zh' })
  expect((setMyCommands.mock.calls[3][0] as Array<{ command: string }>)
    .map(({ command }) => command)).toEqual(['settings', 'id'])
  expect(setMyCommands.mock.calls[3][1]).toEqual({ scope: { type: 'all_group_chats' }, language_code: 'zh' })
})
