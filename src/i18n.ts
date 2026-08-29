import { I18n } from '@grammyjs/i18n'
import { resolve } from 'path'
import { existsSync } from 'fs'
import { BotContext } from './context'

export const i18n = new I18n<BotContext>({
  defaultLocale: 'en',
  directory: existsSync(resolve(__dirname, 'locales'))
    ? resolve(__dirname, 'locales')
    : resolve(__dirname, '..', 'locales'),
  localeNegotiator: (ctx) => ctx.from?.language_code?.toLowerCase().startsWith('zh') ? 'zh-Hans' : 'en',
  fluentBundleOptions: { useIsolating: false },
})
