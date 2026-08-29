import type { MessageEntity } from 'grammy/types'
import { cleanUrl } from '../src/url/clean'
import { cleanTelegramEntities } from '../src/url/entities'
import { assertPublicHttpUrl, expandShortUrl, isPublicAddress, SHORT_LINK_HOSTS } from '../src/url/short-links'
import { cleanUrlsInText } from '../src/url/text'

test('applies ClearURLs rules while preserving raw query order, duplicates, empties, encoding, path, and fragment', async () => {
  const input = 'https://example.com/%E3%83%86%E3%82%B9%E3%83%88?a=1&utm_source=x&a=2&empty=&encoded=%2f#片段'
  const result = await cleanUrl(input)
  expect(result.cleanedUrl).toBe('https://example.com/%E3%83%86%E3%82%B9%E3%83%88?a=1&a=2&empty=&encoded=%2f#片段')
  expect(result.removed).toEqual([{ source: 'clearurls', name: 'utm_source' }])
})

test('honors exceptions, referral opt-in, raw rules, safe string redirections, and malformed URLs', async () => {
  await expect(cleanUrl('https://github.com/x/y?utm_source=keep')).resolves.toMatchObject({
    cleanedUrl: 'https://github.com/x/y?utm_source=keep', removed: [],
  })
  await expect(cleanUrl('https://shop.example/path?ref=partner&utm_medium=x')).resolves.toMatchObject({
    cleanedUrl: 'https://shop.example/path?ref=partner',
  })
  await expect(cleanUrl('https://shop.example/path?ref=partner&utm_medium=x', { removeReferralMarketing: true }))
    .resolves.toMatchObject({ cleanedUrl: 'https://shop.example/path' })
  await expect(cleanUrl('https://www.amazon.com/item/ref=abc?tag=partner&id=1'))
    .resolves.toMatchObject({ cleanedUrl: 'https://www.amazon.com/item?tag=partner&id=1' })
  await expect(cleanUrl('https://www.google.com/url?q=https%3A%2F%2Fexample.com%2Fx%3Futm_source%3Dy'))
    .resolves.toMatchObject({ cleanedUrl: 'https://example.com/x', redirected: true })
  await expect(cleanUrl('%%%')).resolves.toMatchObject({ cleanedUrl: '%%%', unhandledReason: 'malformed-url' })
  await expect(cleanUrl('javascript:alert(1)')).resolves.toMatchObject({ unhandledReason: 'non-http-url' })
})

test('local preserve layer keeps functional service parameters while dropping service trackers', async () => {
  await expect(cleanUrl('https://www.bilibili.com/video/BV1?p=2&t=3&utm_source=x&share_source=copy'))
    .resolves.toMatchObject({ cleanedUrl: 'https://www.bilibili.com/video/BV1?p=2&t=3' })
  await expect(cleanUrl('https://item.taobao.com/item.htm?id=42&utm_source=x&spm=tracker'))
    .resolves.toMatchObject({ cleanedUrl: 'https://item.taobao.com/item.htm?id=42' })
  await expect(cleanUrl('https://y.music.163.com/m/song?id=1&userid=2'))
    .resolves.toMatchObject({ cleanedUrl: 'https://y.music.163.com/m/song?id=1&userid=2' })
})

test('rebuilds Telegram UTF-16 entities from back to front for emoji, repeated URLs, formatting, and text links', async () => {
  const url = 'https://example.com/x?utm_source=a'
  const text = `😀 ${url} + ${url} end`
  const first = text.indexOf(url)
  const second = text.lastIndexOf(url)
  const entities: MessageEntity[] = [
    { type: 'bold', offset: 0, length: text.length },
    { type: 'url', offset: first, length: url.length },
    { type: 'url', offset: second, length: url.length },
    { type: 'text_link', offset: text.length - 3, length: 3, url: 'https://example.com/?utm_campaign=z' },
  ]
  const result = await cleanTelegramEntities(text, entities)
  expect(result.text).toBe('😀 https://example.com/x + https://example.com/x end')
  expect(result.entities).toEqual([
    { type: 'bold', offset: 0, length: result.text.length },
    { type: 'url', offset: first, length: 'https://example.com/x'.length },
    { type: 'url', offset: result.text.lastIndexOf('https://'), length: 'https://example.com/x'.length },
    { type: 'text_link', offset: result.text.length - 3, length: 3, url: 'https://example.com/' },
  ])
})

test('cleans multiple and Unicode URLs in arbitrary inline text without adding whitespace', async () => {
  const input = '前https://example.com/テスト?utm_source=x，后 https://example.com/b?utm_medium=y.'
  await expect(cleanUrlsInText(input)).resolves.toBe('前https://example.com/テスト，后 https://example.com/b.')
})

test('rejects SSRF addresses and follows only allowlisted, bounded, non-cyclic short-link chains', async () => {
  for (const address of ['127.0.0.1', '10.0.0.1', '169.254.1.1', '192.168.1.1', '::1', '::ffff:7f00:1', 'fd00::1', 'ff02::1', '2001:db8::1']) {
    expect(isPublicAddress(address)).toBe(false)
  }
  expect(isPublicAddress('1.1.1.1')).toBe(true)
  await expect(assertPublicHttpUrl('http://user:pass@example.com')).rejects.toThrow('credential-free')
  await expect(assertPublicHttpUrl('http://localhost')).rejects.toThrow('Localhost')
  await expect(assertPublicHttpUrl('https://example.com', async () => [{ address: '127.0.0.1', family: 4 }]))
    .rejects.toThrow('public')

  const chain = new Map([
    ['https://b23.tv/a', 'https://example.com/x?utm_source=z'],
    ['https://example.com/x?utm_source=z', undefined],
  ])
  const requester = jest.fn(async (url: string) => chain.get(url))
  await expect(expandShortUrl('https://b23.tv/a', { requester })).resolves.toBe('https://example.com/x?utm_source=z')
  await expect(expandShortUrl('https://example.com/a', { requester })).resolves.toBe('https://example.com/a')
  const looping = jest.fn(async (url: string) => url === 'https://t.co/a' ? 'https://t.co/b' : 'https://t.co/a')
  await expect(expandShortUrl('https://t.co/a', { requester: looping })).rejects.toThrow('loop')
  const endless = jest.fn(async (url: string) => `${url}x`)
  await expect(expandShortUrl('https://t.co/a', { requester: endless, maxRedirects: 2 })).rejects.toThrow('limit')
})

test('short-link allowlist covers common global and East Asian hosts with exact matching only', async () => {
  expect([...SHORT_LINK_HOSTS]).toEqual([
    'g.co', 'aka.ms', 't.co', 'u.nu', 'bit.ly', 'j.mp', 'bit.do',
    'tinyurl.com', 'tiny.cc', 'is.gd', 'v.gd', 'ow.ly', 'buff.ly', 'cutt.ly',
    'rb.gy', 't.ly', 'shorturl.at', 'rebrand.ly', 'lnkd.in', 'goo.gl',
    'youtu.be', 'maps.app.goo.gl', 'forms.gle', 'fb.watch', 'vm.tiktok.com',
    'vt.tiktok.com', 'spotify.link', 'on.soundcloud.com', 'pin.it', 'redd.it',
    'wa.me', 'a.co', 'amzn.to', 'amzn.asia', 'b23.tv', 't.cn', 'm.tb.cn',
    'v.douyin.com', 'v.kuaishou.com', 'xhslink.com', 'u.jd.com',
  ])
  const requester = jest.fn(async (url: string) => url === 'https://bit.ly/example'
    ? 'https://example.com/expanded'
    : undefined)
  await expect(expandShortUrl('https://bit.ly/example', { requester })).resolves.toBe('https://example.com/expanded')
  await expect(expandShortUrl('https://evil.bit.ly.example/example', { requester })).resolves.toBe('https://evil.bit.ly.example/example')
  await expect(expandShortUrl('https://subdomain.xhslink.com/example', { requester })).resolves.toBe('https://subdomain.xhslink.com/example')
})

test('still performs local cleanup when optional network expansion fails', async () => {
  await expect(cleanUrl('https://example.com/?utm_source=x&keep=1', {
    expandShortUrls: true,
    redirectResolver: async () => { throw new Error('offline') },
  })).resolves.toMatchObject({
    cleanedUrl: 'https://example.com/?keep=1',
    unhandledReason: 'redirect-failed',
  })
})
