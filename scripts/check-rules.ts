import { createHash } from 'crypto'
import { readFileSync, statSync } from 'fs'
import { resolve } from 'path'
import type { ClearUrlCatalog } from '../src/url/types'

const rulesPath = resolve('vendor/clearurls/data.minify.json')
const hashPath = resolve('vendor/clearurls/rules.minify.hash')
const licensePath = resolve('vendor/clearurls/LICENSE')
const sourcePath = resolve('vendor/clearurls/SOURCE.md')
const data = readFileSync(rulesPath)
const declaredHash = readFileSync(hashPath, 'utf8').trim()
const actualHash = createHash('sha256').update(data).digest('hex')
if (!/^[a-f0-9]{64}$/.test(declaredHash) || actualHash !== declaredHash) {
  throw new Error(`ClearURLs hash mismatch: declared ${declaredHash}, actual ${actualHash}`)
}
if (statSync(rulesPath).size > 2 * 1024 * 1024) throw new Error('ClearURLs rules exceed 2 MiB release limit')
if (!readFileSync(licensePath, 'utf8').includes('GNU LESSER GENERAL PUBLIC LICENSE')) {
  throw new Error('ClearURLs LGPL-3.0 license is missing')
}
const source = readFileSync(sourcePath, 'utf8')
if (!source.includes(declaredHash) || !/Revision: `[a-f0-9]{40}`/.test(source)) {
  throw new Error('ClearURLs source metadata is incomplete')
}
const catalog = JSON.parse(data.toString('utf8')) as ClearUrlCatalog
if (!catalog.providers || Object.keys(catalog.providers).length < 100) throw new Error('ClearURLs provider catalog is incomplete')
for (const [name, provider] of Object.entries(catalog.providers)) {
  if (!provider.urlPattern) throw new Error(`Provider ${name} has no urlPattern`)
  new RegExp(provider.urlPattern, 'i')
  for (const pattern of [
    ...(provider.rules || []),
    ...(provider.referralMarketing || []),
    ...(provider.rawRules || []),
    ...(provider.exceptions || []),
    ...(provider.redirections || []),
  ]) new RegExp(pattern, 'i')
}

function localeKeys(path: string): string[] {
  return readFileSync(path, 'utf8').split('\n')
    .filter((line) => /^[a-z0-9-]+\s*=/.test(line))
    .map((line) => line.slice(0, line.indexOf('=')).trim())
    .sort()
}
const englishKeys = localeKeys(resolve('locales/en.ftl'))
const chineseKeys = localeKeys(resolve('locales/zh-Hans.ftl'))
if (JSON.stringify(englishKeys) !== JSON.stringify(chineseKeys)) throw new Error('Locale keys are not synchronized')
console.log(`Rules check passed: ${Object.keys(catalog.providers).length} providers, sha256 ${actualHash}`)
