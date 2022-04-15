import { bot } from '../bot'
import { prisma } from '../db'

bot.command('/clean', async (ctx) => {
    let { count } = await prisma.hideMessage.deleteMany({
        where: {
            user_id: ctx.from.id
        }
    })
    await ctx.reply(`done, all(${count}) hideen inline messages have been cleaned`, {
        reply_to_message_id: ctx.message.message_id
    })
})

