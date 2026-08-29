import type { MessageEntity } from 'grammy/types'
import { Translator } from '../context'
import { ChatMode } from '../db'

export interface DeliveryApi {
  deleteMessage(chatId: number, messageId: number): Promise<unknown>
  sendMessage(chatId: number, text: string, options: {
    entities?: MessageEntity[]
    reply_parameters?: { message_id: number; allow_sending_without_reply: boolean }
  }): Promise<unknown>
}

export function shouldCleanMessage(cleanupEnabled: boolean, mode: ChatMode): boolean {
  return cleanupEnabled && mode !== 'off'
}

export async function deleteOriginalAfterDelivery(
  api: DeliveryApi,
  chatId: number,
  messageId: number,
  t: Translator,
): Promise<'replaced' | 'fallback'> {
  try {
    await api.deleteMessage(chatId, messageId)
    return 'replaced'
  } catch {
    await api.sendMessage(chatId, `⚠️ ${t('delete-permission-fallback')}`, {
      reply_parameters: { message_id: messageId, allow_sending_without_reply: true },
    })
    return 'fallback'
  }
}

export async function deliverCleanedMessage(
  api: DeliveryApi,
  chatId: number,
  messageId: number,
  text: string,
  entities: MessageEntity[],
  mode: ChatMode,
  t: Translator,
): Promise<'replaced' | 'replied' | 'fallback'> {
  if (mode === 'replace') {
    await api.sendMessage(chatId, text, {
      entities,
      reply_parameters: { message_id: messageId, allow_sending_without_reply: true },
    })
    return deleteOriginalAfterDelivery(api, chatId, messageId, t)
  }
  await api.sendMessage(chatId, text, {
    entities,
    reply_parameters: { message_id: messageId, allow_sending_without_reply: true },
  })
  return 'replied'
}
