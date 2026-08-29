import { bot } from './bot'
import { closeDatabase, initializeDatabase } from './db'
import './commands'
import './inline'
import './callback'
import { startGarbageCollection } from './gc'

async function main(): Promise<void> {
  initializeDatabase()
  startGarbageCollection()
  await bot.init()
  const me = bot.botInfo
  console.log(`${new Date().toISOString()} bot starting: ${me.id} @${me.username}`)
  await bot.start({
    onStart: () => console.log(`${new Date().toISOString()} bot started`),
  })
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    bot.stop()
    closeDatabase()
  })
}

main().catch((error) => {
  console.error(error)
  closeDatabase()
  process.exitCode = 1
})
