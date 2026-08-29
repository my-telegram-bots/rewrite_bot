// U+200C is the one marker emitted by this bot's inline Twitter variants.
const PROCESSED_PREFIX = '\u200C'

export function startsWithProcessedMarker(text: string): boolean {
  return text.startsWith(PROCESSED_PREFIX)
}
