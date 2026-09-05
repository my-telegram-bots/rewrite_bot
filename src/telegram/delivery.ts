import type { MessageEntity } from 'grammy/types'
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
  api: Pick<DeliveryApi, 'deleteMessage'>,
  chatId: number,
  messageId: number,
): Promise<'replaced' | 'retained'> {
  try {
    await api.deleteMessage(chatId, messageId)
    return 'replaced'
  } catch {
    return 'retained'
  }
}

export async function deliverCleanedMessage(
  api: DeliveryApi,
  chatId: number,
  messageId: number,
  text: string,
  entities: MessageEntity[],
  mode: ChatMode,
): Promise<'replaced' | 'replied' | 'retained'> {
  if (mode === 'replace') {
    await api.sendMessage(chatId, text, {
      entities,
      reply_parameters: { message_id: messageId, allow_sending_without_reply: true },
    })
    return deleteOriginalAfterDelivery(api, chatId, messageId)
  }
  await api.sendMessage(chatId, text, {
    entities,
    reply_parameters: { message_id: messageId, allow_sending_without_reply: true },
  })
  return 'replied'
}
