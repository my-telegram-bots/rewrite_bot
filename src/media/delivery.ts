import type { InputMediaPhoto, InputMediaVideo, MessageEntity } from 'grammy/types'
import { Translator } from '../context'
import { MultiImageMode } from '../db'
import { buildMediaCaption } from './caption'
import { ResolvedMedia, SocialMediaResolution } from './fxembed'

type ReplyParameters = { message_id: number; allow_sending_without_reply: true }
type CaptionOptions = { caption?: string; caption_entities?: MessageEntity[]; reply_parameters: ReplyParameters }

export interface MediaDeliveryApi {
  sendMessage(chatId: number, text: string, options: { reply_parameters: ReplyParameters }): Promise<unknown>
  sendPhoto(chatId: number, photo: string, options: CaptionOptions): Promise<unknown>
  sendVideo(chatId: number, video: string, options: CaptionOptions): Promise<unknown>
  sendAnimation(chatId: number, animation: string, options: CaptionOptions): Promise<unknown>
  sendMediaGroup(
    chatId: number,
    media: ReadonlyArray<InputMediaPhoto | InputMediaVideo>,
    options: { reply_parameters: ReplyParameters },
  ): Promise<unknown>
}

function isAlbumMedia(media: ResolvedMedia): media is Extract<ResolvedMedia, { kind: 'photo' | 'video' }> {
  return media.kind === 'photo' || media.kind === 'video'
}

export async function deliverSocialMedia(
  api: MediaDeliveryApi,
  chatId: number,
  messageId: number,
  resolution: SocialMediaResolution,
  t: Translator,
  multiImageMode: MultiImageMode = 'media_group',
): Promise<'sent' | 'failed' | 'no_media' | 'not_found'> {
  const reply_parameters: ReplyParameters = {
    message_id: messageId,
    allow_sending_without_reply: true,
  }
  if (resolution.state === 'failed') {
    await api.sendMessage(chatId, t('direct-media-failed-body'), { reply_parameters })
    return 'failed'
  }
  if (resolution.state === 'no_media') return 'no_media'
  if (resolution.state === 'not_found' || resolution.post.media.length === 0) {
    await api.sendMessage(chatId, t('direct-media-not-found-body'), { reply_parameters })
    return 'not_found'
  }

  const caption = buildMediaCaption(resolution.post, t)
  const allPhotos = resolution.post.media.length >= 2 && resolution.post.media.every((media) => media.kind === 'photo')
  if (multiImageMode === 'combine' && resolution.post.combinedImage && allPhotos) {
    await api.sendPhoto(chatId, resolution.post.combinedImage.url, {
      reply_parameters,
      caption: caption.text,
      caption_entities: caption.entities,
    })
    return 'sent'
  }
  let captionPending = true
  for (let index = 0; index < resolution.post.media.length;) {
    const current = resolution.post.media[index]
    if (isAlbumMedia(current)) {
      const run: Array<Extract<ResolvedMedia, { kind: 'photo' | 'video' }>> = []
      while (index < resolution.post.media.length && isAlbumMedia(resolution.post.media[index])) {
        run.push(resolution.post.media[index] as Extract<ResolvedMedia, { kind: 'photo' | 'video' }>)
        index += 1
      }
      if (run.length >= 2) {
        const media = run.map((item, position): InputMediaPhoto | InputMediaVideo => ({
          type: item.kind,
          media: item.url,
          ...(captionPending && position === 0 ? {
            caption: caption.text,
            caption_entities: caption.entities,
          } : {}),
        }))
        await api.sendMediaGroup(chatId, media, { reply_parameters })
        captionPending = false
        continue
      }
      const item = run[0]
      const options: CaptionOptions = {
        reply_parameters,
        ...(captionPending ? { caption: caption.text, caption_entities: caption.entities } : {}),
      }
      if (item.kind === 'photo') await api.sendPhoto(chatId, item.url, options)
      else await api.sendVideo(chatId, item.url, options)
      captionPending = false
      continue
    }
    const options: CaptionOptions = {
      reply_parameters,
      ...(captionPending ? { caption: caption.text, caption_entities: caption.entities } : {}),
    }
    await api.sendAnimation(chatId, current.url, options)
    captionPending = false
    index += 1
  }
  return 'sent'
}
