import { CallbackQuery } from "typegram";
import { bot } from "../bot";
import { get_real_message } from "../handlers/hide_message";
bot.on('callback_query', async (ctx, next) => {
    // WTF is typescript?
    // It's cost me 20min to write this shit.
    const callbackQuery0: any = ctx.callbackQuery
    const callbackQuery: CallbackQuery.DataCallbackQuery = callbackQuery0
    let text = 'error'
    if (callbackQuery.data) {
        const data = callbackQuery.data
        const sdata = data.split('_')
        // sdata[0]
        switch (sdata[0]) {
            case 'r':
                text = await get_real_message(sdata[1])
                break

            default:
                break;
        }
    }
    ctx.answerCbQuery(text, {
        show_alert: true,
        cache_time: 600
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