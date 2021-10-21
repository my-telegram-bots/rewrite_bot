import emojiRegex from 'emoji-regex'
const emoji_regex = emojiRegex()

export default (text: string = '') => {
    let stext: string = text.split('').join(' ')
    for (const match of text.matchAll(emoji_regex)) {
        const emoji = match[0]
        stext = stext.replace(emoji.split('').join(' '), emoji)
    }
    return stext
}