import type { InlineQueryResult } from 'grammy/types'
import { i18n } from '../src/i18n'
import {
  findFirstSocialPost,
  fxEmbedApiUrl,
  parseSocialPostUrl,
  resolveSocialMedia,
  socialMediaInlineResults,
} from '../src/media'
import type { SocialMediaResolution } from '../src/media'

const jsonResponse = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), {
  status: 200,
  headers: { 'content-type': 'application/json', ...init.headers },
  ...init,
})

test('recognizes exact Twitter, X, and Bluesky post URLs without accepting lookalikes', () => {
  expect(parseSocialPostUrl('https://x.com/example/status/2088659395874037770/photo/1')).toMatchObject({
    provider: 'twitter', id: '2088659395874037770', selection: { kind: 'photo', index: 1 },
  })
  expect(parseSocialPostUrl('https://twitter.com/i/web/status/1234567890')).toMatchObject({
    provider: 'twitter', id: '1234567890',
  })
  expect(parseSocialPostUrl('https://bsky.app/profile/did:plc:abc234/post/3l3vgf77uco2g')).toMatchObject({
    provider: 'bluesky', handle: 'did:plc:abc234', rkey: '3l3vgf77uco2g',
  })
  expect(parseSocialPostUrl('https://x.com.evil.test/user/status/1234567890')).toBeUndefined()
  expect(parseSocialPostUrl('https://bsky.app/profile/bsky.app')).toBeUndefined()
  expect(parseSocialPostUrl('https://bsky.app.evil.test/profile/bsky.app/post/3l3vgf77uco2g')).toBeUndefined()
  expect(parseSocialPostUrl('http://x.com/user/status/1234567890')).toBeUndefined()
  expect(findFirstSocialPost('😀 https://example.com then https://bsky.app/profile/bsky.app/post/3l3vgf77uco2g。'))
    .toMatchObject({ provider: 'bluesky', handle: 'bsky.app', rkey: '3l3vgf77uco2g' })
})

test('builds only fixed FxEmbed v2 endpoints', () => {
  expect(fxEmbedApiUrl({ provider: 'twitter', id: '1234567890', sourceUrl: 'https://x.com/a/status/1234567890' }))
    .toBe('https://api.fxtwitter.com/2/status/1234567890')
  expect(fxEmbedApiUrl({
    provider: 'bluesky', handle: 'did:plc:abc234', rkey: '3abc',
    sourceUrl: 'https://bsky.app/profile/did:plc:abc234/post/3abc',
  })).toBe('https://api.fxbsky.app/2/status/did%3Aplc%3Aabc234/3abc')
})

test('preserves media order, selects highest compatible MP4/H.264, and rejects untrusted media hosts', async () => {
  const fetchMock = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => jsonResponse({
    code: 200,
    status: {
      type: 'status', provider: 'twitter', url: 'https://x.com/user/status/1234567890', text: 'caption 😀',
      author: { name: 'Author', screen_name: 'user' },
      media: { all: [
        { type: 'photo', url: 'https://pbs.twimg.com/media/a.jpg?name=orig', width: 100, height: 200 },
        {
          type: 'video', url: 'https://video.twimg.com/large.mp4',
          thumbnail_url: 'https://pbs.twimg.com/thumb.jpg', width: 1920, height: 1080, duration: 4.2,
          formats: [
            { container: 'm3u8', url: 'https://video.twimg.com/list.m3u8' },
            { container: 'mp4', codec: 'h264', bitrate: 320000, url: 'https://video.twimg.com/small.mp4' },
            { container: 'mp4', codec: 'h264', bitrate: 2176000, url: 'https://video.twimg.com/large.mp4' },
            { container: 'mp4', codec: 'hevc', bitrate: 9999999, url: 'https://video.twimg.com/hevc.mp4' },
          ],
        },
        { type: 'photo', url: 'https://evil.test/not-media.jpg', width: 10, height: 10 },
      ], mosaic: {
        type: 'mosaic_photo',
        formats: {
          jpeg: 'https://mosaic.fxtwitter.com/jpeg/1234567890/photo-a/photo-b',
          webp: 'https://mosaic.fxtwitter.com/webp/1234567890/photo-a/photo-b',
        },
      } },
    },
  }))
  const fetchImpl = fetchMock as typeof fetch
  const reference = { provider: 'twitter', id: '1234567890', sourceUrl: 'https://x.com/user/status/1234567890' } as const
  const result = await resolveSocialMedia(reference, { fetchImpl })

  expect(fetchImpl).toHaveBeenCalledTimes(1)
  expect(fetchMock.mock.calls[0][0]).toBe('https://api.fxtwitter.com/2/status/1234567890')
  expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'GET', redirect: 'error' })
  expect(result).toMatchObject({
    state: 'ok',
    post: {
      provider: 'twitter', text: 'caption 😀', authorName: 'Author', authorHandle: 'user',
      media: [
        { kind: 'photo', url: 'https://pbs.twimg.com/media/a.jpg?name=orig' },
        { kind: 'video', url: 'https://video.twimg.com/large.mp4', thumbnailUrl: 'https://pbs.twimg.com/thumb.jpg' },
      ],
    },
  })
})

test('offers a trusted FxTwitter JPEG mosaic without replacing original photos', async () => {
  const reference = { provider: 'twitter', id: '1234567890', sourceUrl: 'https://x.com/a/status/1234567890' } as const
  const response = (jpeg: string) => jsonResponse({
    code: 200,
    status: {
      type: 'status', provider: 'twitter', text: 'two photos',
      media: {
        all: [
          { type: 'photo', url: 'https://pbs.twimg.com/media/a.jpg' },
          { type: 'photo', url: 'https://pbs.twimg.com/media/b.jpg' },
        ],
        mosaic: { type: 'mosaic_photo', formats: { jpeg, webp: 'https://mosaic.fxtwitter.com/webp/id/a/b' } },
      },
    },
  })
  const resolved = await resolveSocialMedia(reference, {
    fetchImpl: (async () => response('https://mosaic.fxtwitter.com/jpeg/id/a/b')) as typeof fetch,
  })
  expect(resolved).toMatchObject({
    state: 'ok',
    post: {
      media: [
        { kind: 'photo', url: 'https://pbs.twimg.com/media/a.jpg' },
        { kind: 'photo', url: 'https://pbs.twimg.com/media/b.jpg' },
      ],
      combinedImage: { kind: 'photo', url: 'https://mosaic.fxtwitter.com/jpeg/id/a/b' },
    },
  })
  const results = socialMediaInlineResults(resolved, (key, values) => i18n.t('en', key, values))
  expect(results.map(({ id }) => id)).toEqual(['media-combined', 'media-photo-1', 'media-photo-2'])
  expect(results[0]).toMatchObject({
    type: 'photo', title: 'Download combined image',
    photo_url: 'https://mosaic.fxtwitter.com/jpeg/id/a/b',
  })

  const rejected = await resolveSocialMedia(reference, {
    fetchImpl: (async () => response('https://evil.test/jpeg/id/a/b')) as typeof fetch,
  })
  expect(rejected).toMatchObject({ state: 'ok', post: { combinedImage: undefined } })
})

test.each([
  {
    name: 'Twitter',
    reference: { provider: 'twitter', id: '1234567890', sourceUrl: 'https://x.com/a/status/1234567890' } as const,
  },
  {
    name: 'Bluesky',
    reference: {
      provider: 'bluesky', handle: 'bsky.app', rkey: '3abc',
      sourceUrl: 'https://bsky.app/profile/bsky.app/post/3abc',
    } as const,
  },
])('treats a valid text-only $name post as no_media', async ({ reference }) => {
  await expect(resolveSocialMedia(reference, {
    fetchImpl: (async () => jsonResponse({
      code: 200,
      status: { type: 'status', provider: reference.provider, text: 'text only' },
    })) as typeof fetch,
  })).resolves.toEqual({ state: 'no_media' })
})

test('does not treat quoted-post or link-preview images as top-level media', async () => {
  const reference = { provider: 'twitter', id: '1234567890', sourceUrl: 'https://x.com/a/status/1234567890' } as const
  await expect(resolveSocialMedia(reference, {
    fetchImpl: (async () => jsonResponse({
      code: 200,
      status: {
        type: 'status', provider: 'twitter', text: 'quoted image and preview',
        quote: { media: { all: [{ type: 'photo', url: 'https://pbs.twimg.com/media/quoted.jpg' }] } },
        embeds: [{ type: 'photo', url: 'https://pbs.twimg.com/media/preview.jpg' }],
      },
    })) as typeof fetch,
  })).resolves.toEqual({ state: 'no_media' })
})

test.each([
  {
    name: 'HLS-only video',
    media: {
      type: 'video', format: 'application/x-mpegURL', url: 'https://video.twimg.com/list.m3u8',
      thumbnail_url: 'https://pbs.twimg.com/thumb.jpg',
      formats: [{ container: 'm3u8', url: 'https://video.twimg.com/list.m3u8' }],
    },
  },
  {
    name: 'non-H.264 video',
    media: {
      type: 'video', format: 'video/mp4', url: 'https://video.twimg.com/hevc.mp4',
      thumbnail_url: 'https://pbs.twimg.com/thumb.jpg',
      formats: [{ container: 'mp4', codec: 'hevc', url: 'https://video.twimg.com/hevc.mp4' }],
    },
  },
  { name: 'untrusted photo', media: { type: 'photo', url: 'https://evil.test/image.jpg' } },
])('keeps MEDIA_NOT_FOUND for top-level $name', async ({ media }) => {
  const resolution = await resolveSocialMedia(
    { provider: 'twitter', id: '1234567890', sourceUrl: 'https://x.com/a/status/1234567890' },
    {
      fetchImpl: (async () => jsonResponse({
        code: 200,
        status: { type: 'status', provider: 'twitter', text: 'incompatible', media: { all: [media] } },
      })) as typeof fetch,
    },
  )
  expect(resolution).toMatchObject({ state: 'ok', post: { media: [] } })
  expect(socialMediaInlineResults(resolution, (key, values) => i18n.t('en', key, values)))
    .toEqual([expect.objectContaining({
      id: 'media-not-found',
      input_message_content: { message_text: expect.stringContaining('MEDIA_NOT_FOUND') },
    })])
})

test('fails closed on oversized metadata, invalid content type, provider mismatch, and timeout', async () => {
  const reference = { provider: 'twitter', id: '1234567890', sourceUrl: 'https://x.com/a/status/1234567890' } as const
  await expect(resolveSocialMedia(reference, {
    maxBodyBytes: 10,
    fetchImpl: (async () => jsonResponse({ code: 200, status: { type: 'status' } })) as typeof fetch,
  })).resolves.toEqual({ state: 'failed' })
  await expect(resolveSocialMedia(reference, {
    fetchImpl: (async () => new Response('no', { headers: { 'content-type': 'text/plain' } })) as typeof fetch,
  })).resolves.toEqual({ state: 'failed' })
  await expect(resolveSocialMedia(reference, {
    fetchImpl: (async () => jsonResponse({ code: 404 }, { status: 404 })) as typeof fetch,
  })).resolves.toEqual({ state: 'not_found' })
  await expect(resolveSocialMedia(reference, {
    fetchImpl: (async () => jsonResponse({ code: 200, status: { type: 'status', provider: 'bluesky' } })) as typeof fetch,
  })).resolves.toEqual({ state: 'failed' })
  await expect(resolveSocialMedia(reference, {
    timeoutMs: 1,
    fetchImpl: ((_input: RequestInfo | URL, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
    })) as typeof fetch,
  })).resolves.toEqual({ state: 'failed' })
})

test('builds native downloadable Telegram results and localized actionable failures', () => {
  const resolution: SocialMediaResolution = {
    state: 'ok',
    post: {
      provider: 'bluesky', sourceUrl: 'https://bsky.app/profile/bsky.app/post/3abc', text: 'hello 😀',
      authorName: 'Bluesky', authorHandle: '@bsky.app',
      media: [
        { kind: 'photo', url: 'https://cdn.bsky.app/img/photo', width: 100, height: 200, altText: 'Alt' },
        { kind: 'gif', url: 'https://pds-cache.fxbsky.app/a.mp4', thumbnailUrl: 'https://video.bsky.app/a.jpg', width: 10, height: 20 },
      ],
    },
  }
  const results = socialMediaInlineResults(resolution, (key, values) => i18n.t('zh-Hans', key, values))
  expect(results).toHaveLength(2)
  expect(results[0]).toMatchObject({
    id: 'media-photo-1', type: 'photo', photo_url: 'https://cdn.bsky.app/img/photo', title: '下载图片 1/2',
  })
  expect((results[0] as Extract<InlineQueryResult, { type: 'photo' }>).caption?.startsWith('\u200C')).toBe(true)
  expect((results[0] as Extract<InlineQueryResult, { type: 'photo' }>).caption_entities).toEqual([
    { type: 'blockquote', offset: 1, length: 'hello 😀'.length },
    { type: 'bold', offset: 1 + 'hello 😀'.length + 2, length: 'Bluesky (@bsky.app)'.length },
    {
      type: 'text_link',
      offset: 1 + 'hello 😀'.length + 2 + 'Bluesky ('.length,
      length: '@bsky.app'.length,
      url: 'https://bsky.app/profile/bsky.app',
    },
    expect.objectContaining({ type: 'text_link', url: resolution.post.sourceUrl }),
  ])
  expect(results[1]).toMatchObject({ id: 'media-gif-2', type: 'mpeg4_gif', title: '下载动画 2/2' })

  const failed = socialMediaInlineResults({ state: 'failed' }, (key, values) => i18n.t('en', key, values))
  expect((failed[0] as Extract<InlineQueryResult, { type: 'article' }>).input_message_content)
    .toMatchObject({ message_text: expect.stringContaining('MEDIA_LOOKUP_FAILED') })
  const missing = socialMediaInlineResults({ state: 'not_found' }, (key, values) => i18n.t('zh-Hans', key, values))
  expect((missing[0] as Extract<InlineQueryResult, { type: 'article' }>).input_message_content)
    .toMatchObject({ message_text: expect.stringContaining('MEDIA_NOT_FOUND') })
  const textOnly = socialMediaInlineResults({ state: 'no_media' }, (key, values) => i18n.t('en', key, values))
  expect(textOnly[0]).toMatchObject({
    id: 'media-no-media',
    input_message_content: {
      message_text: expect.stringMatching(/text-only post.*MEDIA_NOT_FOUND/s),
    },
  })
})
