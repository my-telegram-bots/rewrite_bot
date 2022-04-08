import { bot } from '../bot'
import { MASTER_ID } from '../config'
import emojiRegex from 'emoji-regex'

export const honsole = {
    log: (...args: any[]) => {
        console.log(...args)
    },
    dev: (...args: any[]) => {
        if (process.env.NODE_ENV === 'development') {
            console.log(...args)
        }
    },
    error: (...args: any[]) => {
        bot.telegram.sendMessage(MASTER_ID, `[error] ${args.join(' ')}`)
        console.error(...args)
    },
    warn: (...args: any[]) => {
        bot.telegram.sendMessage(MASTER_ID, `[warn] ${args.join(' ')}`)
        console.warn(...args)
    }
}

export const emoji_regex = emojiRegex()