import { userSetting as TuserSetting } from '@prisma/client'
import emojiRegex from 'emoji-regex'
import { Markup } from 'telegraf'
import { InlineQueryResult, InlineKeyboardButton } from 'typegram'
import { bot } from '../bot'
import { prisma } from '../db'

const emoji_regex = emojiRegex()
/**
 * text to ■■■■ or other char
 * @param text @requires
 * @param placeholder @requires
 * @returns text
 */
export function placeholdeize(text: string, placeholder = '■', mode = 1) {
    for (const match of text.matchAll(emoji_regex)) {
        text = text.replace(match[0], 'h')
    }
    return text.split('').map((c) => {
        return [' ', '\n'].includes(c) ? c : placeholder
    }).join('')
}

export async function hide_message(text: string, u: TuserSetting/*, user_id: bigint*/): Promise<InlineQueryResult[]> {
    // const u = await prisma.userSetting.findFirst({
    //     where: {
    //         user_id
    //     }
    // }) || {
    //     hidePlaceholders: '["■"]',
    //     hideMode: 1
    // }
    // sqlite and sqlserver didn't support JSON directly
    let d = await prisma.hideMessage.create({
        data: {
            user_id: u.user_id,
            text: text,
            time: Math.floor(+new Date() / 1000),
            status: 0
        }
    })
    return JSON.parse(u.hidePlaceholders).map((h: string, id: number) => {
        let ptext = placeholdeize(text, h, u.hideMode)
        //let button = Markup.button.callback('Read', `r_${d.id}`)
        let button: InlineKeyboardButton = {
            text: 'Read',
            callback_data: `r_${d.id}`
        }
        if (text.length > 199) {
            button = {
                text: 'Read',
                url: `https://t.me/${bot.botInfo?.username}?start=${encodeURIComponent(`r_${d.id}`)}`,
            }
        }
        return <InlineQueryResult>{
            // h = hide
            id: `h|${d.id}|${id}`,
            type: 'article',
            title: h,
            description: ptext.substr(0, 64),
            input_message_content: {
                message_text: ptext
            },
            reply_markup: {
                inline_keyboard: Markup.inlineKeyboard([
                    button
                ]).reply_markup.inline_keyboard
            }
        }
    })
}
export async function get_real_message(id: string): Promise<any> {
    let d = await prisma.hideMessage.findFirst({
        where: {
            id: id
        }
    })
    return d?.text
}