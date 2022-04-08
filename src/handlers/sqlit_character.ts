import { emoji_regex } from "./common"

export default (text: string = '') => {
    let stext: string = text.split('').join(' ')
    for (const match of text.matchAll(emoji_regex)) {
        const emoji = match[0]
        stext = stext.replace(emoji.split('').join(' '), emoji)
    }
    return stext
}