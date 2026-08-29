import { bot } from '../bot'
import { get_real_message } from '../handlers/hide_message'
bot.callbackQuery(/^r_/, async (ctx) => {
    const id = ctx.callbackQuery.data.slice(2)
    const text = id ? await get_real_message(id, ctx.t) : ctx.t('message-not-found')
    await ctx.answerCallbackQuery({ text, show_alert: true, cache_time: 60 })
})
