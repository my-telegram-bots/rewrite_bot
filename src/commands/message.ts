import type { Message, MessageEntity } from 'grammy/types'
import { bot } from '../bot';
import { ChatMode, dbRepositories } from '../db'
import { cleanTelegramEntities, expandShortUrl } from '../url'
import { Translator } from '../context'
import { deliverCleanedMessage, DeliveryApi, shouldCleanMessage } from '../telegram/delivery'
import { startsWithProcessedMarker } from '../telegram/processed-marker'

async function handleTextMessage(
  api: DeliveryApi,
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
  if (!shouldCleanMessage(settings.cleanupEnabled, mode)) return
  const result = await cleanTelegramEntities(message.text, message.entities || [], {
    removeReferralMarketing: settings.removeReferralMarketing,
    expandShortUrls: settings.expandShortUrls,
    redirectResolver: settings.expandShortUrls ? expandShortUrl : undefined,
  })
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
