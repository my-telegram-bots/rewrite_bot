import { bot } from '../bot'
import { dbRepositories } from '../db'

bot.command('clean', async (ctx) => {
    const count = dbRepositories().deleteHiddenMessagesForUser(ctx.from!.id)
    await ctx.reply(ctx.t('clean-done', { count }), {
        reply_parameters: { message_id: ctx.msg.message_id },
    })
})
