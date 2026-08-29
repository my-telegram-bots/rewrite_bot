import type { InlineQueryResult } from 'grammy/types'
import { Translator } from '../context'
import { buildMediaCaption } from './caption'
import { ResolvedSocialPost, SocialMediaResolution } from './fxembed'

function truncate(value: string, limit: number): string {
  const points = Array.from(value)
  return points.length <= limit ? value : `${points.slice(0, Math.max(0, limit - 1)).join('')}…`
}

function dimensions(width?: number, height?: number): string {
  return width && height ? `${width}×${height}` : ''
}

export function socialMediaInlineResults(
  resolution: SocialMediaResolution,
  t: Translator,
): InlineQueryResult[] {
  if (resolution.state === 'failed') {
    return [{
      id: 'media-lookup-failed',
      type: 'article',
      title: t('inline-media-failed-title'),
      description: t('inline-media-failed-body').slice(0, 64),
      input_message_content: { message_text: t('inline-media-failed-body') },
    }]
  }
  if (resolution.state === 'not_found' || resolution.post.media.length === 0) {
    return [{
      id: 'media-not-found',
      type: 'article',
      title: t('inline-media-not-found-title'),
      description: t('inline-media-not-found-body').slice(0, 64),
      input_message_content: { message_text: t('inline-media-not-found-body') },
    }]
  }
  const total = resolution.post.media.length
  const mediaCaption = buildMediaCaption(resolution.post, t)
  const results = resolution.post.media.map((media, index): InlineQueryResult => {
    const position = index + 1
    const common = {
      id: `media-${media.kind}-${position}`,
      title: t(media.kind === 'photo' ? 'inline-media-photo-title' : media.kind === 'gif'
        ? 'inline-media-gif-title'
        : 'inline-media-video-title', { position, total }),
      description: dimensions(media.width, media.height),
      caption: mediaCaption.text,
      caption_entities: mediaCaption.entities,
    }
    if (media.kind === 'photo') {
      return {
        ...common,
        type: 'photo',
        photo_url: media.url,
        thumbnail_url: media.url,
        photo_width: media.width,
        photo_height: media.height,
        description: media.altText ? truncate(media.altText, 64) : common.description,
      }
    }
    if (media.kind === 'gif') {
      return {
        ...common,
        type: 'mpeg4_gif',
        mpeg4_url: media.url,
        thumbnail_url: media.thumbnailUrl,
        mpeg4_width: media.width,
        mpeg4_height: media.height,
        mpeg4_duration: media.duration ? Math.ceil(media.duration) : undefined,
      }
    }
    return {
      ...common,
      type: 'video',
      video_url: media.url,
      thumbnail_url: media.thumbnailUrl,
      mime_type: 'video/mp4',
      video_width: media.width,
      video_height: media.height,
      video_duration: media.duration ? Math.ceil(media.duration) : undefined,
    }
  })
  if (resolution.post.combinedImage) {
    results.unshift({
      id: 'media-combined',
      type: 'photo',
      title: t('inline-media-combined-title'),
      description: '',
      photo_url: resolution.post.combinedImage.url,
      thumbnail_url: resolution.post.combinedImage.url,
      caption: mediaCaption.text,
      caption_entities: mediaCaption.entities,
    })
  }
  return results
}
