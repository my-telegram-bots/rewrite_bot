import { dbRepositories } from './db'
/**
 * clean database
 * @returns true
 */
export async function clean_database(): Promise<boolean> {
    const count = dbRepositories().cleanupHiddenMessages()
    if (count > 0) {
        console.log('[ok]', 'cleanup', count, 'items in hide message')
    }
    return true
}

export function startGarbageCollection(): NodeJS.Timeout {
  return setInterval(() => { void clean_database() }, 600 * 1000)
}
