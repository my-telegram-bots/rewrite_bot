import { cleanUrl } from './clean'
import { CleanUrlOptions } from './types'

const URL_PATTERN = /https?:\/\/[^\s<>，。！？、；：（）【】]+/giu

function splitTrailingPunctuation(candidate: string): [string, string] {
  let url = candidate
  let suffix = ''
  while (/[.,!?，。！？、]$/.test(url)) {
    suffix = url.slice(-1) + suffix
    url = url.slice(0, -1)
  }
  return [url, suffix]
}

export async function cleanUrlsInText(text: string, options: CleanUrlOptions = {}): Promise<string> {
  const matches = [...text.matchAll(URL_PATTERN)]
  let output = text
  for (const match of matches.reverse()) {
    const start = match.index as number
    const [url, suffix] = splitTrailingPunctuation(match[0])
    const result = await cleanUrl(url, options)
    output = output.slice(0, start) + result.cleanedUrl + suffix + output.slice(start + match[0].length)
  }
  return output
}
