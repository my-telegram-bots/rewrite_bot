import { bot } from '../bot'
import { prisma } from '../db'


bot.on('chosen_inline_result', async (ctx) => {
    const sresult_id = ctx.chosenInlineResult.result_id.split('|')
    switch (sresult_id[0]) {
        case 'h':
            try {
                await prisma.hideMessage.update({
                    where: {
                        id: sresult_id[1]
                    },
                    data: {
                        status: 1
                    }
                })
                console.log('[ok]', 'change state', sresult_id[1], 'ok')
            } catch (error) {
                console.warn('[error]', 'change state', sresult_id[1], 'error', error)
            }
            break
    }
})