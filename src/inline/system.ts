import { InlineQueryResult } from 'typegram'
import { bot } from '../bot'
import { d_get_userSetting, prisma } from '../db'
import { hide_message } from '../handlers/hide_message'

bot.on('inline_query', async (ctx, next) => {
    if (ctx.inlineQuery.query.startsWith('!s ')) {
        let user_id = ctx.from.id
        let result: InlineQueryResult[] = []
        const command = ctx.inlineQuery.query.substring(3)
        if (parseInt(command) !== NaN) {
            let d = await prisma.normalMessage.findFirst({
                where: {
                    user_id: user_id,
                    message_id: parseInt(command)
                }
            })
            if (d) {
                let u = await d_get_userSetting(<bigint><unknown>user_id)
                result = await hide_message({
                    mode: 'message',
                    type: d.message_type,
                    text: d.text
                }, u)
            }
        }
        if (result.length > 0) {
            ctx.answerInlineQuery(result, {
                cache_time: 10,
                is_personal: true
            })
        }
    } else {
        next()
    }
})