import { isIP } from 'net'
import { lookup as dnsLookup } from 'dns/promises'
import { request as httpRequest } from 'http'
import { request as httpsRequest } from 'https'

export const SHORT_LINK_HOSTS = new Set([
  // Generic shorteners.
  'g.co',
  'aka.ms',
  't.co',
  'u.nu',
  'bit.ly',
  'j.mp',
  'bit.do',
  'tinyurl.com',
  'tiny.cc',
  'is.gd',
  'v.gd',
  'ow.ly',
  'buff.ly',
  'cutt.ly',
  'rb.gy',
  't.ly',
  'shorturl.at',
  'rebrand.ly',
  'lnkd.in',
  'goo.gl',
  // Platform-owned share links.
  'youtu.be',
  'maps.app.goo.gl',
  'forms.gle',
  'fb.watch',
  'vm.tiktok.com',
  'vt.tiktok.com',
  'spotify.link',
  'on.soundcloud.com',
  'pin.it',
  'redd.it',
  'wa.me',
  // Commerce and East Asian services.
  'a.co',
  'amzn.to',
  'amzn.asia',
  'b23.tv',
  't.cn',
  'm.tb.cn',
  'v.douyin.com',
  'v.kuaishou.com',
  'xhslink.com',
  'u.jd.com',
])

export type AddressResolver = (hostname: string) => Promise<Array<{ address: string; family: number }>>

const resolveAddresses: AddressResolver = async (hostname) => {
  const records = await dnsLookup(hostname, { all: true, verbatim: true })
  return records.map(({ address, family }) => ({ address, family }))
}

function publicIpv4(address: string): boolean {
  const octets = address.split('.').map(Number)
  const [a, b] = octets
  return !(
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 88) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51) ||
    (a === 203 && b === 0) ||
    a >= 224
  )
}

function publicIpv6(address: string): boolean {
  const normalized = address.toLowerCase()
  if (normalized === '::' || normalized === '::1') return false
  if (normalized.startsWith('::')) return false
  if (normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe8') ||
      normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb') ||
      normalized.startsWith('ff')) return false
  if (normalized.startsWith('2001:db8') || normalized.startsWith('2001:0:') ||
      normalized.startsWith('2001:0000:') || normalized.startsWith('2002:') ||
      normalized.startsWith('100:')) return false
  return true
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address)
  return family === 4 ? publicIpv4(address) : family === 6 ? publicIpv6(address) : false
}

export async function assertPublicHttpUrl(
  rawUrl: string,
  resolver: AddressResolver = resolveAddresses,
): Promise<{ url: URL; address: string; family: number }> {
  const url = new URL(rawUrl)
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password) {
    throw new Error('Only credential-free HTTP(S) redirect targets are allowed')
  }
  if (url.hostname === 'localhost' || url.hostname.endsWith('.localhost')) {
    throw new Error('Localhost redirect targets are not allowed')
  }
  const records = isIP(url.hostname)
    ? [{ address: url.hostname, family: isIP(url.hostname) }]
    : await resolver(url.hostname)
  if (records.length === 0 || records.some(({ address }) => !isPublicAddress(address))) {
    throw new Error('Redirect target does not resolve exclusively to public addresses')
  }
  return { url, ...records[0] }
}

export type RedirectRequester = (
  rawUrl: string,
  resolver: AddressResolver,
  timeoutMs: number,
  maxResponseBytes: number,
) => Promise<string | undefined>

export const requestRedirect: RedirectRequester = async (
  rawUrl: string,
  resolver: AddressResolver,
  timeoutMs: number,
  maxResponseBytes: number,
): Promise<string | undefined> => {
  const { url, address, family } = await assertPublicHttpUrl(rawUrl, resolver)
  const transport = url.protocol === 'https:' ? httpsRequest : httpRequest
  return new Promise((resolve, reject) => {
    const req = transport(url, {
      method: 'GET',
      headers: { 'User-Agent': 'rewrite-bot/1.0', Range: `bytes=0-${maxResponseBytes - 1}` },
      lookup: (_hostname, _options, callback) => callback(null, address, family),
    }, (response) => {
      const location = response.headers.location
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && location) {
        response.destroy()
        resolve(new URL(location, url).href)
        return
      }
      let bytes = 0
      response.on('data', (chunk: Buffer) => {
        bytes += chunk.length
        if (bytes > maxResponseBytes) response.destroy(new Error('Short-link response exceeds size limit'))
      })
      response.on('end', () => resolve(undefined))
      response.on('error', reject)
    })
    req.setTimeout(timeoutMs, () => req.destroy(new Error('Short-link request timed out')))
    req.on('error', reject)
    req.end()
  })
}

export interface ExpandShortUrlOptions {
  resolver?: AddressResolver
  timeoutMs?: number
  maxRedirects?: number
  maxResponseBytes?: number
  requester?: RedirectRequester
}

export async function expandShortUrl(rawUrl: string, options: ExpandShortUrlOptions = {}): Promise<string> {
  const initial = new URL(rawUrl)
  if (!SHORT_LINK_HOSTS.has(initial.hostname.toLowerCase())) return rawUrl
  const resolver = options.resolver || resolveAddresses
  const timeoutMs = options.timeoutMs ?? 3000
  const maxRedirects = options.maxRedirects ?? 5
  const maxResponseBytes = options.maxResponseBytes ?? 64 * 1024
  const requester = options.requester || requestRedirect
  const visited = new Set<string>()
  let current = rawUrl
  for (let count = 0; count <= maxRedirects; count += 1) {
    if (visited.has(current)) throw new Error('Short-link redirect loop detected')
    visited.add(current)
    const next = await requester(current, resolver, timeoutMs, maxResponseBytes)
    if (!next) return current
    if (count === maxRedirects) throw new Error('Short-link redirect limit exceeded')
    current = next
  }
  return current
}
