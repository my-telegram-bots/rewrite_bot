const MAX_MESSAGE_AGE_MS = 5 * 60 * 1000

export function isMessageExpired(date: number): boolean {
  return Date.now() - date * 1000 > MAX_MESSAGE_AGE_MS
}
