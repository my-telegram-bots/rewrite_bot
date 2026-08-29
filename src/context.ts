import type { I18nFlavor } from '@grammyjs/i18n'
import type { Context } from 'grammy'

export type BotContext = Context & I18nFlavor
export type Translator = (key: string, context?: Record<string, string | number>) => string
