import { clearUrlCatalog } from './catalog'
import { shouldPreserveParameter, shouldRemoveLocally } from './local-rules'
import { CleanUrlOptions, CleanUrlResult, ClearUrlProvider } from './types'

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '))
  } catch {
    return value
  }
}

function safeRegex(pattern: string, flags = ''): RegExp | undefined {
  try {
    return new RegExp(pattern, flags)
  } catch {
    return undefined
  }
}

function matchingProviders(url: string): ClearUrlProvider[] {
  return Object.values(clearUrlCatalog.providers).filter((provider) => {
    const pattern = safeRegex(provider.urlPattern, 'i')
    if (!pattern || !pattern.test(url)) return false
    return !(provider.exceptions || []).some((exception) => safeRegex(exception, 'i')?.test(url))
  })
}

function redirectedUrl(rawUrl: string, providers: ClearUrlProvider[]): string | undefined {
  for (const provider of providers) {
    for (const source of provider.redirections || []) {
      const match = safeRegex(source, 'i')?.exec(rawUrl)
      if (!match?.[1]) continue
      const target = safeDecode(match[1])
      try {
        const parsed = new URL(target)
        if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && !parsed.username && !parsed.password) {
          return target
        }
      } catch {
        continue
      }
    }
  }
  return undefined
}

function cleanOnce(
  rawUrl: string,
  removeReferralMarketing: boolean,
  visited = new Set<string>(),
): CleanUrlResult {
  if (visited.has(rawUrl) || visited.size >= 5) {
    return {
      originalUrl: rawUrl,
      cleanedUrl: rawUrl,
      removed: [],
      redirected: false,
      unhandledReason: 'redirect-rejected',
    }
  }
  visited.add(rawUrl)
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return { originalUrl: rawUrl, cleanedUrl: rawUrl, removed: [], redirected: false, unhandledReason: 'malformed-url' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { originalUrl: rawUrl, cleanedUrl: rawUrl, removed: [], redirected: false, unhandledReason: 'non-http-url' }
  }

  const providers = matchingProviders(rawUrl)
  const redirection = redirectedUrl(rawUrl, providers)
  if (redirection && redirection !== rawUrl) {
    const nested = cleanOnce(redirection, removeReferralMarketing, visited)
    return { ...nested, originalUrl: rawUrl, redirected: true }
  }

  const hashIndex = rawUrl.indexOf('#')
  const queryIndex = rawUrl.indexOf('?')
  if (queryIndex < 0 || (hashIndex >= 0 && queryIndex > hashIndex)) {
    let cleaned = rawUrl
    const removed: CleanUrlResult['removed'] = []
    for (const provider of providers) {
      for (const rawRule of provider.rawRules || []) {
        const pattern = safeRegex(rawRule, 'gi')
        if (!pattern || !pattern.test(cleaned)) continue
        pattern.lastIndex = 0
        cleaned = cleaned.replace(pattern, '')
        removed.push({ source: 'clearurls', name: 'raw-rule' })
      }
    }
    return { originalUrl: rawUrl, cleanedUrl: cleaned, removed, redirected: false }
  }

  const queryEnd = hashIndex >= 0 ? hashIndex : rawUrl.length
  const prefix = rawUrl.slice(0, queryIndex)
  const suffix = rawUrl.slice(queryEnd)
  const rawFields = rawUrl.slice(queryIndex + 1, queryEnd).split('&')
  const kept: string[] = []
  const removed: CleanUrlResult['removed'] = []

  for (const field of rawFields) {
    const separator = field.indexOf('=')
    const rawName = separator < 0 ? field : field.slice(0, separator)
    const name = safeDecode(rawName)
    if (shouldPreserveParameter(parsed.hostname, parsed.pathname, name)) {
      kept.push(field)
      continue
    }
    const clearUrlRule = providers.some((provider) => {
      const rules = [...(provider.rules || []), ...(removeReferralMarketing ? provider.referralMarketing || [] : [])]
      return rules.some((rule) => safeRegex(`^(?:${rule})$`, 'i')?.test(name))
    })
    const localRule = shouldRemoveLocally(parsed.hostname, parsed.pathname, name)
    if (clearUrlRule || localRule) {
      removed.push({ source: clearUrlRule ? 'clearurls' : 'local', name })
    } else {
      kept.push(field)
    }
  }

  let cleaned = prefix + (kept.length ? `?${kept.join('&')}` : '') + suffix
  for (const provider of providers) {
    for (const rawRule of provider.rawRules || []) {
      const pattern = safeRegex(rawRule, 'gi')
      if (!pattern || !pattern.test(cleaned)) continue
      pattern.lastIndex = 0
      cleaned = cleaned.replace(pattern, '')
      removed.push({ source: 'clearurls', name: 'raw-rule' })
    }
  }
  return { originalUrl: rawUrl, cleanedUrl: cleaned, removed, redirected: false }
}

export async function cleanUrl(rawUrl: string, options: CleanUrlOptions = {}): Promise<CleanUrlResult> {
  let source = rawUrl
  let networkRedirected = false
  if (options.expandShortUrls && options.redirectResolver) {
    try {
      const expanded = await options.redirectResolver(rawUrl)
      if (expanded !== rawUrl) {
        source = expanded
        networkRedirected = true
      }
    } catch {
      return { ...cleanOnce(rawUrl, options.removeReferralMarketing === true), unhandledReason: 'redirect-failed' }
    }
  }
  const result = cleanOnce(source, options.removeReferralMarketing === true)
  return { ...result, originalUrl: rawUrl, redirected: result.redirected || networkRedirected }
}
