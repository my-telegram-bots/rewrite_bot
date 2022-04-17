import { CallbackQuery } from 'typegram'
import { bot } from '../bot'
import { get_real_message } from '../handlers/hide_message'
bot.on('callback_query', async (ctx, next) => {
    
    // @ts-ignore
    let data = ctx.callbackQuery.data
    let text = 'error'
    if (data) {
        const sdata = data.split('_')
        // sdata[0]
        switch (sdata[0]) {
            // r = read
            case 'r':
                text = await get_real_message(sdata[1])
                break
            
            default:
                break
        }
    }
    ctx.answerCbQuery(text, {
        show_alert: true,
        cache_time: 60
    })
})
// I can't test this regex
//           r\_(.{8}\-.{4}\-.{4}\-.{4}\-.{12})
// bot.hears(/r_(.*)/, (ctx => {
//     //await get_real_message()
//     ctx.answerCbQuery(JSON.stringify(ctx.match), {
//         show_alert: true
//     })
// }))