// U+200C is the one marker emitted by this bot's processed inline output.
export const PROCESSED_MARKER = '\u200C'

export function startsWithProcessedMarker(text: string): boolean {
  return text.startsWith(PROCESSED_MARKER)
}
