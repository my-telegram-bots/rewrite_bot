import { Bot } from 'grammy'
import { BOT_TOKEN, MASTER_ID } from './config'
import { BotContext } from './context'
import { i18n } from './i18n'
import { safeLogValue } from './handlers/common'

if (!BOT_TOKEN) throw new Error('BOT_TOKEN is required')

export const bot = new Bot<BotContext>(BOT_TOKEN)
bot.use(i18n)

bot.catch(async ({ error }) => {
  const safeError = safeLogValue(error)
  console.error(safeError)
  if (MASTER_ID) {
    await bot.api.sendMessage(MASTER_ID, `rewrite_bot error: ${safeError}`).catch((sendError) => {
      console.error(safeLogValue(sendError))
    })
  }
})
