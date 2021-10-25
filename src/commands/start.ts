import { bot } from '../bot'
import { get_real_message } from '../handlers/hide_message'

bot.start(async (ctx) => {
    if (ctx.startPayload) {
        let text = ''
        const stext = ctx.startPayload.split('_')
        // sdata[0]
        switch (stext[0]) {
            case 'r':
                text = await get_real_message(stext[1])
                break

            default:
                break;
        }
        if (text) {
            ctx.reply(text)
        }
    } else {
        ctx.reply('Welcome to use rewrite bot')
    }
})