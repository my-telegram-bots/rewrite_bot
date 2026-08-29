export interface ClearUrlProvider {
  urlPattern: string
  rules?: string[]
  rawRules?: string[]
  referralMarketing?: string[]
  exceptions?: string[]
  redirections?: string[]
  completeProvider?: boolean
  forceRedirection?: boolean
}

export interface ClearUrlCatalog {
  providers: Record<string, ClearUrlProvider>
}

export interface CleanUrlOptions {
  removeReferralMarketing?: boolean
  expandShortUrls?: boolean
  redirectResolver?: (url: string) => Promise<string>
}

export interface RemovedUrlItem {
  source: 'clearurls' | 'local'
  name: string
}

export interface CleanUrlResult {
  originalUrl: string
  cleanedUrl: string
  removed: RemovedUrlItem[]
  redirected: boolean
  unhandledReason?: 'malformed-url' | 'non-http-url' | 'redirect-rejected' | 'redirect-failed'
}
