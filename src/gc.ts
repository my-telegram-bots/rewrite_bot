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
                    lte: Math.floor(+new Date() / 1000) - 60
                }
            }]
        }
    })
    if (d.count > 0) {
        console.log('[ok]', 'cleanup', d.count, 'items in hide message')
    }
    return true
}

clean_database()
setInterval(() => {
    clean_database()
}, 1000)
