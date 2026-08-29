import type { InlineQueryResult, InlineKeyboardButton } from 'grammy/types'
import { bot } from '../bot'
import { dbRepositories, UserSettings } from '../db'
import { emoji_regex } from './common'
import { Translator } from '../context'

interface HideText {
  text: string
  mode: 'inline' | 'message'
  type: number
}

/**
 * text to ████ or other char
 * @param text @requires
 * @param placeholder @requires
 * @returns text
 */
export function placeholdeize(text: string, placeholder = '█', mode = 1) {
    if (mode === 2) return placeholder
    text = text.replace(emoji_regex, 'h')
    return text.split('').map((c) => {
        return [' ', '\n'].includes(c) ? c : placeholder
    }).join('')
}

/**
 * hide message by text
 */
export async function hide_message(m: HideText, u: UserSettings, t: Translator): Promise<InlineQueryResult[]> {
    const d = dbRepositories().createHiddenMessage({
        userId: u.userId,
        text: m.text,
        time: Math.floor(Date.now() / 1000),
        status: 0,
        expiredTime: u.expiredTimeOffset > 0 ? Math.floor(Date.now() / 1000) + u.expiredTimeOffset : 0,
    })
    return u.hidePlaceholders.map((h: string, id: number) => {
        const ptext = placeholdeize(m.text, h, u.hideMode)
        // let button = Markup.button.callback('Read', `r_${d.id}`)
        let button: InlineKeyboardButton = {
            text: t('read-button'),
            callback_data: `r_${d.id}`
        }
        if (m.text.length > 199) {
            button = {
                text: t('read-button'),
                url: `https://t.me/${bot.botInfo.username}?start=${encodeURIComponent(`r_${d.id}`)}`,
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
                inline_keyboard: [[button]]
            }
        }
    })
}

export async function get_real_message(id: string, t: Translator): Promise<string> {
    const result = dbRepositories().consumeHiddenMessage(id)
    if (result.state === 'ok') return result.message.text
    if (result.state === 'expired') return t('message-expired')
    if (result.state === 'exhausted') return t('message-exhausted')
    return t('message-not-found')
}
