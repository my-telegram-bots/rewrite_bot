import { bot } from '../bot'
import { ExtraAnswerInlineQuery } from 'telegraf/typings/telegram-types'
import { InlineQueryResult, MessageEntity } from 'typegram'
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
        text = await remove_utm(text, 0)
        const u = await d_get_userSetting(ctx.from.id)
        const rm_utm_text = await remove_utm(text)
        const splited_text = sqlit_character(text)
        const md5 = crypto.createHash('md5').update(text).digest('hex').toString()
        const base64_e = Buffer.from(text, 'utf-8').toString('base64')
        const base64_d = Buffer.from(text, 'base64').toString('utf-8')
        const uri_d = await remove_utm(text, 3)
        if (rm_utm_text.includes('https://twitter.com/')) {
            const vxtwitter_text1 = rm_utm_text.replaceAll('https://twitter.com/', '\u200Chttps://twitter.com/')
            const vxtwitter_text2 = rm_utm_text.replaceAll('https://twitter.com/', 'https://vxtwitter.com/')
            let vxtwitter_entity: MessageEntity[] = []
            let temp_vxtwitter_text1 = ''
            // \u200C is a zero-width space
            // https://github.com/grammyjs/stateless-question/blob/d304caa4d8ebbaa1c2aca431e95f1a09ddb772f2/source/identifier.ts#L5
            vxtwitter_text1.split('\u200C').forEach((url, index) => {
                if (url.startsWith('https://twitter.com/')) {
                    vxtwitter_entity.push({
                        type: 'text_link',
                        offset: index === 1 ? 0 : temp_vxtwitter_text1.length + index,
                        url: url.replace('twitter','vxtwitter'),
                        length: 1
                    })
                    temp_vxtwitter_text1 += '\u200C' + url
                }
            })
            results.push({
                id: 'vxtwitter link 1',
                type: 'article',
                title: 'send as vxtwitter 1 (show with original link)',
                description: vxtwitter_text1.substring(0, 64),
                input_message_content: {
                    message_text: vxtwitter_text1,
                    entities: vxtwitter_entity
                }
            })
            results.push({
                id: 'vxtwitter link 2',
                type: 'article',
                title: 'send as vxtwitter 2 (show with vx link)',
                description: vxtwitter_text2.substring(0, 64),
                input_message_content: {
                    message_text: vxtwitter_text2
                }
            })
        }
        if (rm_utm_text !== text) {
            results.push({
                id: 'rm utm',
                type: 'article',
                title: 'rm utm params',
                description: rm_utm_text.substring(0, 64),
                input_message_content: {
                    message_text: rm_utm_text
                }
            })
            const rm_utm_text_decodeURI = await remove_utm(rm_utm_text, 3)
            if (rm_utm_text !== rm_utm_text_decodeURI) {
                results.push({
                    id: 'rm utm with decodeURI',
                    type: 'article',
                    title: 'rm utm params with decodeURI',
                    description: rm_utm_text_decodeURI.substring(0, 64),
                    input_message_content: {
                        message_text: rm_utm_text_decodeURI
                    }
                })
            }
        }
        if (uri_d !== text) {
            results.push({
                id: 'url with decodeURI',
                type: 'article',
                title: 'url with decodeURI',
                description: uri_d.substring(0, 64),
                input_message_content: {
                    message_text: uri_d
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
                description: splited_text.substring(0, 64),
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