import type { Api } from 'grammy'
import type { BotCommand } from 'grammy/types'
import { i18n } from '../i18n'

type CommandMenuApi = Pick<Api, 'setMyCommands'>
type Locale = 'en' | 'zh-Hans'

const PRIVATE_COMMANDS = ['start', 'settings', 'clean', 'id'] as const
const GROUP_COMMANDS = ['settings', 'id'] as const

function localizedCommands(names: readonly string[], locale: Locale): BotCommand[] {
  return names.map((command) => ({
    command,
    description: i18n.t(locale, `command-${command}`),
  }))
}

export async function synchronizeCommandMenus(api: CommandMenuApi): Promise<void> {
  await api.setMyCommands(localizedCommands(PRIVATE_COMMANDS, 'en'), {
    scope: { type: 'all_private_chats' },
  })
  await api.setMyCommands(localizedCommands(GROUP_COMMANDS, 'en'), {
    scope: { type: 'all_group_chats' },
  })
  await api.setMyCommands(localizedCommands(PRIVATE_COMMANDS, 'zh-Hans'), {
    scope: { type: 'all_private_chats' },
    language_code: 'zh',
  })
  await api.setMyCommands(localizedCommands(GROUP_COMMANDS, 'zh-Hans'), {
    scope: { type: 'all_group_chats' },
    language_code: 'zh',
  })
}
