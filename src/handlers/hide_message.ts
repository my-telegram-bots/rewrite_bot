import { userSetting as TuserSetting } from '@prisma/client'
import emojiRegex from 'emoji-regex'
import { Markup } from 'telegraf'
import { InlineQueryResult, InlineKeyboardButton } from 'typegram'
import { bot } from '../bot'
import { prisma } from '../db'
import { ThideText } from '../schema'

const emoji_regex = emojiRegex()
/**
 * text to ████ or other char
 * @param text @requires
 * @param placeholder @requires
 * @returns text
 */
export function placeholdeize(text: string, placeholder = '█', mode = 1) {
    for (const match of text.matchAll(emoji_regex)) {
        text = text.replace(match[0], 'h')
    }
    return text.split('').map((c) => {
        return [' ', '\n'].includes(c) ? c : placeholder
    }).join('')
}

/**
 * hide message by text
 */
export async function hide_message(m: ThideText, u: TuserSetting): Promise<InlineQueryResult[]> {
    let d = await prisma.hideMessage.create({
        data: {
            user_id: u.user_id,
            text: m.text,
            time: Math.floor(+new Date() / 1000),
            status: 0
        }
    })
    // sqlite and sqlserver dont't support JSON directly
    return JSON.parse(u.hide_placeholders).map((h: string, id: number) => {
        let ptext = placeholdeize(m.text, h, u.hide_mode)
        // let button = Markup.button.callback('Read', `r_${d.id}`)
        let button: InlineKeyboardButton = {
            text: 'Read',
            callback_data: `r_${d.id}`
        }
        if (m.text.length > 199) {
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
            description: ptext.substring(0, h.length === 1 ? 64 : (64 * h.length - (ptext.replaceAll(' ', '').replaceAll('\n', '').length * (h.length - 1)))),
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
    if (d?.status === 0) {
        await prisma.hideMessage.update({
            where: {
                id: id
            },
            data: {
                status: 1
            }
        })
    }
    return d?.text
}