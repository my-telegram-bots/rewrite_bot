import { bot } from '../bot'
import { prisma } from '../db'
import { honsole } from '../handlers/common'


bot.on('chosen_inline_result', async (ctx) => {
    const sresult = ctx.chosenInlineResult.result_id.split('|')
    switch (sresult[0]) {
        case 'h':
            try {
                await prisma.hideMessage.update({
                    where: {
                        id: sresult[1]
                    },
                    data: {
                        status: 1
                    }
                })
                honsole.dev('[ok]', 'change state', sresult[1], 'ok')
            } catch (error) {
                console.warn('[error]', 'change state', sresult[1], 'error', error)
            }
            break
    }
})