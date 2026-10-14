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
import { isMessageExpired } from '../telegram/message-age'

async function handleTextMessage(
  api: DeliveryApi & MediaDeliveryApi,
  chatId: number,
  message: Message.TextMessage,
  t: Translator,
  privateUserId?: number,
): Promise<void> {
  if (isMessageExpired(message.date)) return
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
  if (isMessageExpired(message.date)) return
  const linkedReference = result.entities
    .filter((entity) => entity.type === 'text_link')
    .map((entity) => entity.type === 'text_link' ? findFirstSocialPost(entity.url) : undefined)
    .find(Boolean)
  const reference = settings.socialMediaEnabled ? findFirstSocialPost(result.text) || linkedReference : undefined
  if (reference) {
    const resolution = await resolveSocialMedia(reference)
    if (isMessageExpired(message.date)) return
    const delivery = await deliverSocialMedia(
      api,
      chatId,
      message.message_id,
      resolution,
      t,
      settings.multiImageMode,
    )
    if (delivery === 'sent' && !isPrivate && mode === 'replace') {
      await deleteOriginalAfterDelivery(api, chatId, message.message_id)
    }
    if (delivery !== 'no_media') return
  }
  if (!result.changed || isMessageExpired(message.date)) return
  await deliverCleanedMessage(
    api,
    chatId,
    message.message_id,
    result.text,
    result.entities,
    mode,
  )
}

bot.on('message:text', async (ctx) => {
  await handleTextMessage(ctx.api, ctx.chat.id, ctx.message, ctx.t, ctx.chat.type === 'private' ? ctx.from.id : undefined)
})

bot.on('channel_post:text', async (ctx) => {
  await handleTextMessage(ctx.api, ctx.chat.id, ctx.channelPost, ctx.t)
})
