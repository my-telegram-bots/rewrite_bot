import { bot } from '../bot'

bot.command('id', async (ctx) => {
    let text = ctx.chat.id < 0 ? `#chatid: \`${ctx.chat.id}\`\n` : ''
    text += ctx.from ? `#userid: \`${ctx.from.id}\`` : ''
    await ctx.reply(text, {
        reply_parameters: { message_id: ctx.msg.message_id },
        parse_mode: 'Markdown',
    })
})
