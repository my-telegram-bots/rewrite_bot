import { bot } from '../bot'
import { ExtraAnswerInlineQuery } from 'telegraf/typings/telegram-types'
import { InlineQueryResult } from 'typegram'
import sqlit_character from '../handlers/sqlit_character'
import remove_utm from '../handlers/remove_utm'
import crypto from 'crypto'
import { hide_message, placeholdeize } from '../handlers/hide_message'
import { userSetting as TuserSetting } from '.prisma/client'
import { d_get_userSetting, prisma } from '../db'

bot.on('inline_query', async (ctx) => {
    let text = ctx.inlineQuery.query
    let results: InlineQueryResult[] = []
    let options: ExtraAnswerInlineQuery = {
        is_personal: true,
        cache_time: 10
    }
    if (text) {
        const u = await d_get_userSetting(ctx.from.id)
        const rm_utm_text = await remove_utm(text)
        const splited_text = sqlit_character(text)
        const md5 = crypto.createHash('md5').update(text).digest('hex').toString()
        const base64_e = Buffer.from(text, 'utf-8').toString('base64')
        const base64_d = Buffer.from(text, 'base64').toString('utf-8')
        if (rm_utm_text !== text) {
            results.push({
                id: 'rm utm',
                type: 'article',
                title: 'rm utm params',
                description: rm_utm_text.substr(0, 64),
                input_message_content: {
                    message_text: rm_utm_text
                }
            })
        }
        results = [...results, ...await hide_message({
            text: text,
            mode: 'inline',
            type: 1
        }, <TuserSetting>u)]
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
                id: 's c',
                type: 'article',
                title: 'split character',
                description: splited_text.substr(0, 64),
                input_message_content: {
                    message_text: splited_text
                }
            })
        }

        results.push({
            id: 'md5',
            type: 'article',
            title: 'md5',
            description: md5,
            input_message_content: {
                message_text: md5
            }
        })

        if (base64_e.length < 4000) {
            results.push({
                id: 'b e',
                type: 'article',
                title: 'base64 encode',
                description: base64_e,
                input_message_content: {
                    message_text: base64_e
                }
            })
        }

        if (base64_d && base64_d.length > 1) {
            results.push({
                id: 'b d',
                type: 'article',
                title: 'base64 decode (may error)',
                description: base64_d,
                input_message_content: {
                    message_text: base64_d
                }
            })
        }
    } else {
        options = {
            is_personal: true,
            cache_time: 0,
            switch_pm_parameter: 'help',
            switch_pm_text: 'get started'
        }
    }
    ctx.answerInlineQuery(results, options)
})