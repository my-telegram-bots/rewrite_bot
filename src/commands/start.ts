import { bot } from '../bot'
import { get_real_message } from '../handlers/hide_message'

bot.command('start', async (ctx) => {
    const payload = typeof ctx.match === 'string' ? ctx.match : ''
    if (payload) {
        let text = ''
        const stext = payload.split('_')
        // sdata[0]
        switch (stext[0]) {
            case 'r':
                text = await get_real_message(stext[1], ctx.t)
                break

            default:
                break;
        }
        if (text) {
            await ctx.reply(text, {
                reply_parameters: { message_id: ctx.msg.message_id },
                protect_content: true,
            })
        }
    } else {
        await ctx.reply(ctx.t('start'), {
            reply_parameters: { message_id: ctx.msg.message_id },
        })
    }
})
