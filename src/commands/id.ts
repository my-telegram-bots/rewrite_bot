import { bot } from '../bot';

bot.command('/id', async (ctx) => {
    let text = ctx.chat.id < 0 ? `#chatid: \`${ctx.chat.id}\`\n` : ''
    // channel post maybe didn't have .from
    text += ctx.from ? `#userid: \`${ctx.from.id}\`` : ''
    await bot.telegram.sendMessage(ctx.chat.id, text, {
        reply_to_message_id: ctx.message.message_id,
        parse_mode: 'Markdown'
    })
})