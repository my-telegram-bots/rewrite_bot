import emojiRegex from 'emoji-regex'

export function safeLogValue(value: unknown): string {
    const rendered = value instanceof Error ? `${value.name}: ${value.message}` : String(value)
    return rendered.replace(/https?:\/\/\S+/giu, '[URL_REDACTED]')
}

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
        console.error(...args.map(safeLogValue))
    },
    warn: (...args: any[]) => {
        console.warn(...args.map(safeLogValue))
    }
}

export const emoji_regex = emojiRegex()
