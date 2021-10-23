import { prisma } from './db'
/**
 * clean database
 * @returns true
 */
export async function clean_database(): Promise<Boolean> {
    // 
    let d = await prisma.hideMessage.deleteMany({
        where: {
            AND: [{
                status: 0
            }, {
                time: {
                    lte: Math.floor(+new Date() / 1000) - 10
                }
            }]
        }
    })
    if (d.count > 0) {
        console.log('[ok]', 'cleanup', d.count, 'items in hide message')
    }
    return true
}

setInterval(() => {
    clean_database()
}, 600 * 1000)
