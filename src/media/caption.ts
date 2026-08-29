import type { MessageEntity } from 'grammy/types'
import { Translator } from '../context'
import { PROCESSED_MARKER } from '../telegram/processed-marker'
import { ResolvedSocialPost } from './fxembed'

export interface MediaCaption {
  text: string
  entities: MessageEntity[]
}

function truncateUtf16(value: string, limit: number): string {
  if (value.length <= limit) return value
  if (limit <= 0) return ''
  const suffix = '…'
  let result = ''
  for (const point of value) {
    if (result.length + point.length + suffix.length > limit) break
    result += point
  }
  return `${result}${suffix}`
}

export function buildMediaCaption(post: ResolvedSocialPost, t: Translator): MediaCaption {
  const author = post.authorName
    ? `${post.authorName}${post.authorHandle ? ` (@${post.authorHandle})` : ''}`
    : post.authorHandle ? `@${post.authorHandle}` : ''
  const viewOriginal = t('media-view-original')
  const fixedSuffix = `${author ? `\n\n${author}` : ''}\n${viewOriginal}`
  const body = truncateUtf16(post.text, Math.max(0, 1024 - PROCESSED_MARKER.length - fixedSuffix.length))
  const text = `${PROCESSED_MARKER}${body}${fixedSuffix}`
  const entities: MessageEntity[] = []
  if (body) entities.push({ type: 'blockquote', offset: PROCESSED_MARKER.length, length: body.length })
  if (author) {
    entities.push({
      type: 'bold',
      offset: PROCESSED_MARKER.length + body.length + 2,
      length: author.length,
    })
  }
  entities.push({
    type: 'text_link',
    offset: text.length - viewOriginal.length,
    length: viewOriginal.length,
    url: post.sourceUrl,
  })
  return { text, entities }
}
