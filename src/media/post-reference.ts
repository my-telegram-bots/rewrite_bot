export type SocialProvider = 'twitter' | 'bluesky'

export interface SocialMediaSelection {
  kind: 'photo' | 'video'
  index: number
}

export type SocialPostReference =
  | { provider: 'twitter'; id: string; sourceUrl: string; selection?: SocialMediaSelection }
  | { provider: 'bluesky'; handle: string; rkey: string; sourceUrl: string; selection?: SocialMediaSelection }

const URL_PATTERN = /https?:\/\/[^\s<>，。！？、；：（）【】]+/giu
const TWITTER_HOSTS = new Set(['twitter.com', 'www.twitter.com', 'mobile.twitter.com', 'x.com', 'www.x.com'])
const BLUESKY_HOSTS = new Set(['bsky.app', 'www.bsky.app'])

function withoutTrailingPunctuation(value: string): string {
  return value.replace(/[.,!?，。！？、]+$/u, '')
}

function decodeIdentifier(value: string): string | undefined {
  try {
    return decodeURIComponent(value)
  } catch {
    return undefined
  }
}

function mediaSelection(segments: string[], postIdIndex: number): SocialMediaSelection | undefined {
  const kind = segments[postIdIndex + 1]
  const position = segments[postIdIndex + 2]
  if ((kind !== 'photo' && kind !== 'video') || !position || !/^\d{1,2}$/.test(position)) return undefined
  const index = Number(position)
  return index >= 1 && index <= 10 ? { kind, index } : undefined
}

export function parseSocialPostUrl(value: string): SocialPostReference | undefined {
  let url: URL
  try {
    url = new URL(withoutTrailingPunctuation(value))
  } catch {
    return undefined
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return undefined

  const host = url.hostname.toLowerCase()
  const segments = url.pathname.split('/').filter(Boolean)
  if (TWITTER_HOSTS.has(host)) {
    const statusIndex = segments.indexOf('status')
    const id = statusIndex >= 1 ? segments[statusIndex + 1] : undefined
    if (!id || !/^\d{2,20}$/.test(id)) return undefined
    return { provider: 'twitter', id, sourceUrl: url.href, selection: mediaSelection(segments, statusIndex + 1) }
  }
  if (BLUESKY_HOSTS.has(host) && segments.length >= 4 && segments[0] === 'profile' && segments[2] === 'post') {
    const handle = decodeIdentifier(segments[1])
    const rkey = decodeIdentifier(segments[3])
    if (!handle || !/^[A-Za-z0-9._:-]{1,253}$/.test(handle)) return undefined
    if (!rkey || !/^[A-Za-z0-9._~:-]{1,128}$/.test(rkey)) return undefined
    return { provider: 'bluesky', handle, rkey, sourceUrl: url.href, selection: mediaSelection(segments, 3) }
  }
  return undefined
}

export function findFirstSocialPost(text: string): SocialPostReference | undefined {
  for (const match of text.matchAll(URL_PATTERN)) {
    const reference = parseSocialPostUrl(match[0])
    if (reference) return reference
  }
  return undefined
}
