export type SocialProvider = 'twitter' | 'bluesky'

export type SocialPostReference =
  | { provider: 'twitter'; id: string; sourceUrl: string }
  | { provider: 'bluesky'; handle: string; rkey: string; sourceUrl: string }

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
    return { provider: 'twitter', id, sourceUrl: url.href }
  }
  if (BLUESKY_HOSTS.has(host) && segments.length >= 4 && segments[0] === 'profile' && segments[2] === 'post') {
    const handle = decodeIdentifier(segments[1])
    const rkey = decodeIdentifier(segments[3])
    if (!handle || !/^[A-Za-z0-9._:-]{1,253}$/.test(handle)) return undefined
    if (!rkey || !/^[A-Za-z0-9._~:-]{1,128}$/.test(rkey)) return undefined
    return { provider: 'bluesky', handle, rkey, sourceUrl: url.href }
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
