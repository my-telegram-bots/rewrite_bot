import { Telegraf } from 'telegraf'
import { BOT_TOKEN, MASTER_ID } from './config'
import { prisma } from './db'

export const bot = new Telegraf(BOT_TOKEN)

bot.launch().then(async () => {
    try {
        // db test
        await prisma.$connect()
        console.log(new Date(), 'bot started!', bot.botInfo?.id, '@' + bot.botInfo?.username)
        if (MASTER_ID) {
            bot.telegram.sendMessage(MASTER_ID, `${new Date().toString()} bot started!`)
        }
    } catch (error) {
        console.log(new Date(), 'bot error', error)
    }
}).catch((e) => {
    console.error(e)
    console.error('You are offline or bad bot token')
    process.exit()
})

bot.use((ctx, next) => {
    next()
})
bot.catch(async (err, ctx) => {
    await ctx.telegram.sendMessage(MASTER_ID, 'got error' + err)
    await ctx.telegram.sendMessage(MASTER_ID, JSON.stringify(err))
})
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))