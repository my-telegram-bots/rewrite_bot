import { bot } from '../bot'
import { get_real_message } from '../handlers/hide_message'

bot.start(async (ctx) => {
    let default_extra = {
        reply_to_message_id: ctx.message.message_id
    }
    if (ctx.startPayload) {
        let text = ''
        const stext = ctx.startPayload.split('_')
        // sdata[0]
        switch (stext[0]) {
            case 'r':
                text = await get_real_message(stext[1])
                // @ts-ignore
                default_extra.protect_content = true
                break

            default:
                break;
        }
        if (text) {
            await ctx.reply(text, {
                ...default_extra
            })
        }
    } else {
        await ctx.reply('Welcome to use rewrite bot', {
            ...default_extra
        })
    }
})