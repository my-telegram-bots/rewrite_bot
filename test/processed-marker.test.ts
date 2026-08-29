import { startsWithProcessedMarker } from '../src/telegram/processed-marker'

test('recognizes only the leading U+200C marker emitted by this bot', () => {
  expect(startsWithProcessedMarker('\u200Chttps://example.com/?utm_source=x')).toBe(true)
})

test.each(['\u200B', '\u200D', '\u2060', '\uFEFF'])(
  'does not treat a different leading zero-width character %p as this bot output',
  (marker) => expect(startsWithProcessedMarker(`${marker}https://example.com/?utm_source=x`)).toBe(false),
)

test('does not skip ordinary or non-leading U+200C text', () => {
  expect(startsWithProcessedMarker('https://example.com/?utm_source=x')).toBe(false)
  expect(startsWithProcessedMarker(`x\u200Chttps://example.com/?utm_source=x`)).toBe(false)
})
