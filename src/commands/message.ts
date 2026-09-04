import type { Message, MessageEntity } from 'grammy/types'
import { bot } from '../bot';
import { ChatMode, dbRepositories } from '../db'
import { deliverSocialMedia, findFirstSocialPost, MediaDeliveryApi, resolveSocialMedia } from '../media'
import { cleanTelegramEntities, expandShortUrl } from '../url'
import { Translator } from '../context'
import {
  deleteOriginalAfterDelivery,
  deliverCleanedMessage,
  DeliveryApi,
  shouldCleanMessage,
} from '../telegram/delivery'
import { startsWithProcessedMarker } from '../telegram/processed-marker'

async function handleTextMessage(
  api: DeliveryApi & MediaDeliveryApi,
  chatId: number,
  message: Message.TextMessage,
  t: Translator,
  privateUserId?: number,
): Promise<void> {
  if (startsWithProcessedMarker(message.text)) return
  const isPrivate = privateUserId !== undefined
  const userSettings = isPrivate ? dbRepositories().getOrCreateUserSettings(privateUserId) : undefined
  const chatSettings = isPrivate ? undefined : dbRepositories().getOrCreateChatSettings(chatId)
  const settings = userSettings || chatSettings!
  const mode: ChatMode = userSettings ? 'reply' : chatSettings!.mode
  const shouldClean = shouldCleanMessage(settings.cleanupEnabled, mode)
  const result = shouldClean
    ? await cleanTelegramEntities(message.text, message.entities || [], {
      removeReferralMarketing: settings.removeReferralMarketing,
      expandShortUrls: settings.expandShortUrls,
      redirectResolver: settings.expandShortUrls ? expandShortUrl : undefined,
    })
    : { text: message.text, entities: message.entities || [], changed: false }
  const linkedReference = result.entities
    .filter((entity) => entity.type === 'text_link')
    .map((entity) => entity.type === 'text_link' ? findFirstSocialPost(entity.url) : undefined)
    .find(Boolean)
  const reference = settings.socialMediaEnabled ? findFirstSocialPost(result.text) || linkedReference : undefined
  if (reference) {
    const delivery = await deliverSocialMedia(
      api,
      chatId,
      message.message_id,
      await resolveSocialMedia(reference),
      t,
      settings.multiImageMode,
    )
    if (delivery === 'sent' && !isPrivate && mode === 'replace') {
      await deleteOriginalAfterDelivery(api, chatId, message.message_id, t)
    }
    if (delivery !== 'no_media') return
  }
  if (!result.changed) return
  await deliverCleanedMessage(
    api,
    chatId,
    message.message_id,
    result.text,
    result.entities,
    mode,
    t,
  )
}

bot.on('message:text', async (ctx) => {
  await handleTextMessage(ctx.api, ctx.chat.id, ctx.message, ctx.t, ctx.chat.type === 'private' ? ctx.from.id : undefined)
})

bot.on('channel_post:text', async (ctx) => {
  await handleTextMessage(ctx.api, ctx.chat.id, ctx.channelPost, ctx.t)
})
