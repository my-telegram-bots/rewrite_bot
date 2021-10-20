import { bot } from "./bot"
import { ExtraAnswerInlineQuery } from 'telegraf/typings/telegram-types'
import { InlineQueryResult } from "typegram"
import sqlit_character from "./handlers/sqlit_character"
import remove_utm from "./handlers/remove_utm"


bot.on('inline_query', async (ctx) => {
    let text = ctx.inlineQuery.query
    let results: InlineQueryResult[] = []
    let options: ExtraAnswerInlineQuery = {
        is_personal: true,
        cache_time: 10
    }
    if (text) {
        const rm_utm_text = await remove_utm(text)
        const splited_text = sqlit_character(text)

        if (rm_utm_text !== text) {
            results.push({
                id: 'rm utm',
                type: 'article',
                title: 'rm utm params',
                description: rm_utm_text.substr(0,64),
                input_message_content: {
                    message_text: rm_utm_text
                }
            })
        }
        if (splited_text.length > 4000) { // 4096
            results.push({
                id: 'text too long',
                type: 'article',
                title: 'error: text too long',
                input_message_content: {
                    message_text: 'text too long'
                }
            })
        } else {
            results.push({
                id: 'split character',
                type: 'article',
                title: splited_text.substr(0, 64),
                input_message_content: {
                    message_text: splited_text
                }
            })
        }
    }
    ctx.answerInlineQuery(results, options)
})