import type { InlineQueryResult } from 'grammy/types'
import { bot } from '../bot'
import { dbRepositories } from '../db'
import { hide_message } from '../handlers/hide_message'

bot.on('inline_query', async (ctx, next) => {
    if (ctx.inlineQuery.query.startsWith('!s ')) {
        const userId = ctx.from.id
        let result: InlineQueryResult[] = []
        const command = ctx.inlineQuery.query.substring(3)
        if (/^\d+$/.test(command)) {
            const d = dbRepositories().getHiddenNormalMessage(userId, command)
            if (d) {
                const u = dbRepositories().getOrCreateUserSettings(userId)
                result = await hide_message({
                    mode: 'message',
                    type: d.messageType,
                    text: d.text
                }, u, ctx.t)
            }
        }
        if (result.length === 0) {
            result = [{
                id: 'stored-message-not-found',
                type: 'article',
                title: ctx.t('inline-message-not-found-title'),
                description: ctx.t('inline-message-not-found-body').slice(0, 64),
                input_message_content: { message_text: ctx.t('inline-message-not-found-body') },
            }]
        }
        await ctx.answerInlineQuery(result, {
            cache_time: 10,
            is_personal: true
        })
    } else {
        await next()
    }
})
