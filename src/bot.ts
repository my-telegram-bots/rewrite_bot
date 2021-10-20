import { PrismaClient } from '@prisma/client'
import { Telegraf } from 'telegraf'
import { BOT_TOKEN, MASTER_ID } from './config'
const prisma = new PrismaClient()

export const bot = new Telegraf(BOT_TOKEN)

bot.launch().then(async () => {
    try {
        // db test
        await prisma.$connect()
        console.log(new Date(), 'bot started!')
        if (MASTER_ID) {
            bot.telegram.sendMessage(MASTER_ID, `${new Date().toString()} bot started!`)
        }
    } catch (error) {

    }
}).catch((e) => {
    console.error(e)
    console.error('You are offline or bad bot token')
    process.exit()
})

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))