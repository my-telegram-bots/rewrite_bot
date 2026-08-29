import { safeLogValue } from '../src/handlers/common'

test('diagnostic logging redacts complete HTTP URLs', () => {
  expect(safeLogValue(new Error('failed https://example.com/private?token=secret now')))
    .toBe('Error: failed [URL_REDACTED] now')
})
