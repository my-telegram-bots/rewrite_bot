import { SocialPostReference, SocialProvider } from './post-reference'

const API_ORIGINS: Record<SocialProvider, string> = {
  twitter: 'https://api.fxtwitter.com',
  bluesky: 'https://api.fxbsky.app',
}
const TRUSTED_MEDIA_HOSTS: Record<SocialProvider, ReadonlySet<string>> = {
  twitter: new Set(['pbs.twimg.com', 'video.twimg.com']),
  bluesky: new Set(['cdn.bsky.app', 'video.bsky.app', 'pds-cache.fxbsky.app']),
}
const DEFAULT_TIMEOUT_MS = 4000
const DEFAULT_MAX_BODY_BYTES = 512 * 1024

type JsonRecord = Record<string, unknown>

export interface ResolvedPhoto {
  kind: 'photo'
  url: string
  width?: number
  height?: number
  altText?: string
}

export interface ResolvedVideo {
  kind: 'video' | 'gif'
  url: string
  thumbnailUrl: string
  width?: number
  height?: number
  duration?: number
}

export type ResolvedMedia = ResolvedPhoto | ResolvedVideo

export interface ResolvedSocialPost {
  provider: SocialProvider
  sourceUrl: string
  text: string
  authorName?: string
  authorHandle?: string
  media: ResolvedMedia[]
}

export type SocialMediaResolution =
  | { state: 'ok'; post: ResolvedSocialPost }
  | { state: 'not_found' }
  | { state: 'failed' }

export interface FxEmbedOptions {
  fetchImpl?: typeof fetch
  timeoutMs?: number
  maxBodyBytes?: number
}

function record(value: unknown): JsonRecord | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : undefined
}

function finitePositive(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

function trustedHttpsUrl(value: unknown, provider: SocialProvider): string | undefined {
  if (typeof value !== 'string') return undefined
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return undefined
    return TRUSTED_MEDIA_HOSTS[provider].has(url.hostname.toLowerCase()) ? url.href : undefined
  } catch {
    return undefined
  }
}

function photoFrom(value: unknown, provider: SocialProvider): ResolvedPhoto | undefined {
  const item = record(value)
  if (!item || item.type !== 'photo') return undefined
  const url = trustedHttpsUrl(item.url, provider)
  if (!url) return undefined
  return {
    kind: 'photo',
    url,
    width: finitePositive(item.width),
    height: finitePositive(item.height),
    altText: typeof item.altText === 'string' && item.altText ? item.altText : undefined,
  }
}

function videoFrom(value: unknown, provider: SocialProvider): ResolvedVideo | undefined {
  const item = record(value)
  if (!item || (item.type !== 'video' && item.type !== 'gif')) return undefined
  const formats = Array.isArray(item.formats) ? item.formats.map(record).filter(Boolean) as JsonRecord[] : []
  const compatible = formats
    .filter((format) => format.container === 'mp4' && (format.codec === undefined || format.codec === 'h264'))
    .map((format) => ({
      url: trustedHttpsUrl(format.url, provider),
      score: finitePositive(format.bitrate) || finitePositive(format.size) ||
        ((finitePositive(format.width) || 0) * (finitePositive(format.height) || 0)),
    }))
    .filter((format): format is { url: string; score: number } => Boolean(format.url))
    .sort((left, right) => right.score - left.score)
  const primaryIsMp4 = item.format === 'video/mp4' || formats.some((format) => format.container === 'mp4')
  const url = compatible[0]?.url || (primaryIsMp4 ? trustedHttpsUrl(item.url, provider) : undefined)
  const thumbnailUrl = trustedHttpsUrl(item.thumbnail_url, provider)
  if (!url || !thumbnailUrl) return undefined
  return {
    kind: item.type,
    url,
    thumbnailUrl,
    width: finitePositive(item.width),
    height: finitePositive(item.height),
    duration: finitePositive(item.duration),
  }
}

function mediaFromStatus(status: JsonRecord, provider: SocialProvider): ResolvedMedia[] {
  const media = record(status.media)
  if (!media) return []
  const ordered = Array.isArray(media.all)
    ? media.all
    : [...(Array.isArray(media.photos) ? media.photos : []), ...(Array.isArray(media.videos) ? media.videos : [])]
  const results: ResolvedMedia[] = []
  const seen = new Set<string>()
  for (const item of ordered) {
    const resolved = photoFrom(item, provider) || videoFrom(item, provider)
    if (resolved && !seen.has(resolved.url)) {
      seen.add(resolved.url)
      results.push(resolved)
    }
  }
  return results
}

async function readJsonLimited(response: Response, maxBodyBytes: number): Promise<unknown> {
  const declaredLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > maxBodyBytes) throw new Error('response too large')
  if (!response.body) return JSON.parse(await response.text())
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBodyBytes) {
      await reader.cancel()
      throw new Error('response too large')
    }
    chunks.push(value)
  }
  return JSON.parse(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8'))
}

export function fxEmbedApiUrl(reference: SocialPostReference): string {
  if (reference.provider === 'twitter') {
    return `${API_ORIGINS.twitter}/2/status/${encodeURIComponent(reference.id)}`
  }
  return `${API_ORIGINS.bluesky}/2/status/${encodeURIComponent(reference.handle)}/${encodeURIComponent(reference.rkey)}`
}

export async function resolveSocialMedia(
  reference: SocialPostReference,
  options: FxEmbedOptions = {},
): Promise<SocialMediaResolution> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  try {
    const response = await (options.fetchImpl || fetch)(fxEmbedApiUrl(reference), {
      method: 'GET',
      redirect: 'error',
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        'user-agent': 'rewrite_bot/0.0.1 (+https://github.com/my-telegram-bots/rewrite_bot)',
      },
    })
    if (!response.ok || !response.headers.get('content-type')?.toLowerCase().includes('application/json')) {
      return response.status === 404 ? { state: 'not_found' } : { state: 'failed' }
    }
    const payload = record(await readJsonLimited(response, options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES))
    const status = record(payload?.status)
    if (!payload || payload.code !== 200 || !status || status.type !== 'status') return { state: 'not_found' }
    const provider = status.provider === reference.provider ? reference.provider : undefined
    if (!provider) return { state: 'failed' }
    return {
      state: 'ok',
      post: {
        provider,
        sourceUrl: reference.sourceUrl,
        text: typeof status.text === 'string' ? status.text : '',
        authorName: typeof record(status.author)?.name === 'string' ? record(status.author)?.name as string : undefined,
        authorHandle: typeof record(status.author)?.screen_name === 'string'
          ? record(status.author)?.screen_name as string
          : undefined,
        media: mediaFromStatus(status, provider),
      },
    }
  } catch {
    return { state: 'failed' }
  } finally {
    clearTimeout(timer)
  }
}
