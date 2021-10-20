import { bot } from "./bot"
import { ExtraAnswerInlineQuery } from 'telegraf/typings/telegram-types'
import { InlineQueryResult } from "typegram"
import sqlit_character from "./handlers/sqlit_character"


bot.on('inline_query', async (ctx) => {
    let text = ctx.inlineQuery.query
    let results: InlineQueryResult[] = []
    let options: ExtraAnswerInlineQuery = {
        is_personal: true,
        cache_time: 10
    }
    if (text) {
        const splited_text = sqlit_character(text)
        if (splited_text.length > 4000) {
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