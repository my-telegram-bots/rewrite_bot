import type { ChatMember } from 'grammy/types'
import { ChatSettings, UserSettings } from '../src/db'
import {
  deleteOriginalAfterDelivery,
  deliverCleanedMessage,
  DeliveryApi,
  shouldCleanMessage,
} from '../src/telegram/delivery'
import { chatSettingsPanel, isAdministrator, userSettingsPanel } from '../src/ui/settings-panel'

const t = (key: string, values: Record<string, string | number> = {}) =>
  `${key}${Object.keys(values).length ? `:${JSON.stringify(values)}` : ''}`

const user: UserSettings = {
  userId: '1', cleanupEnabled: true, expandShortUrls: false, removeReferralMarketing: false,
  socialMediaEnabled: true,
  multiImageMode: 'media_group',
  hideMode: 1, hideDisabled: '', expiredTimeOffset: 0, hidePlaceholders: ['█'],
}
const chat: ChatSettings = {
  chatId: '-1', cleanupEnabled: true, expandShortUrls: false, removeReferralMarketing: false,
  socialMediaEnabled: true, multiImageMode: 'media_group', mode: 'replace',
}

test('settings panels keep fixed row geometry across every normal toggle and mode', () => {
  const userReady = userSettingsPanel(user, t)
  const userChanged = userSettingsPanel({ ...user, cleanupEnabled: false, expandShortUrls: true, hideMode: 2 }, t)
  expect(userReady.text.split('\n')).toHaveLength(8)
  expect(userChanged.text.split('\n')).toHaveLength(8)
  expect(userReady.keyboard.inline_keyboard.map((row) => row.length)).toEqual([1, 1, 1, 2, 1, 1])
  expect(userChanged.keyboard.inline_keyboard.map((row) => row.length)).toEqual([1, 1, 1, 2, 1, 1])
  for (const mode of ['replace', 'reply', 'off'] as const) {
    for (const mayEdit of [true, false]) {
      const panel = chatSettingsPanel({ ...chat, mode }, mayEdit, t)
      expect(panel.text.split('\n')).toHaveLength(9)
      expect(panel.keyboard.inline_keyboard.map((row) => row.length)).toEqual([3, 1, 1, 1, 2, 1])
    }
  }
})

test('administrator check accepts only creator and administrator states', () => {
  expect(isAdministrator({ status: 'creator' } as ChatMember)).toBe(true)
  expect(isAdministrator({ status: 'administrator' } as ChatMember)).toBe(true)
  expect(isAdministrator({ status: 'member' } as ChatMember)).toBe(false)
  expect(isAdministrator({ status: 'restricted' } as ChatMember)).toBe(false)
})

function api(deleteFails = false): DeliveryApi & { sendMessage: jest.Mock; deleteMessage: jest.Mock } {
  return {
    sendMessage: jest.fn(async () => ({})),
    deleteMessage: jest.fn(async () => {
      if (deleteFails) throw new Error('not enough rights')
      return {}
    }),
  }
}

test('replace sends first, then deletes; delete failure quietly keeps both messages', async () => {
  const successful = api()
  await expect(deliverCleanedMessage(successful, -1, 5, 'clean', [], 'replace')).resolves.toBe('replaced')
  expect(successful.sendMessage.mock.invocationCallOrder[0]).toBeLessThan(successful.deleteMessage.mock.invocationCallOrder[0])

  const failed = api(true)
  await expect(deliverCleanedMessage(failed, -1, 5, 'clean', [], 'replace')).resolves.toBe('retained')
  expect(failed.sendMessage).toHaveBeenCalledTimes(1)
  expect(failed.sendMessage).toHaveBeenCalledWith(
    -1,
    'clean',
    { entities: [], reply_parameters: { message_id: 5, allow_sending_without_reply: true } },
  )
})

test('successful non-text delivery shares replace deletion and silently retains on failure', async () => {
  const successful = api()
  await expect(deleteOriginalAfterDelivery(successful, -1, 5)).resolves.toBe('replaced')
  expect(successful.deleteMessage).toHaveBeenCalledWith(-1, 5)
  expect(successful.sendMessage).not.toHaveBeenCalled()

  const failed = api(true)
  await expect(deleteOriginalAfterDelivery(failed, -1, 5)).resolves.toBe('retained')
  expect(failed.sendMessage).not.toHaveBeenCalled()
})

test('reply mode never deletes and keeps the clean reply adjacent through reply_parameters', async () => {
  const target = api()
  await expect(deliverCleanedMessage(target, -1, 5, 'clean', [], 'reply')).resolves.toBe('replied')
  expect(target.deleteMessage).not.toHaveBeenCalled()
  expect(target.sendMessage.mock.calls[0][2]).toMatchObject({
    reply_parameters: { message_id: 5, allow_sending_without_reply: true },
  })
})

test('off mode and the master cleanup switch prevent group processing', () => {
  expect(shouldCleanMessage(true, 'off')).toBe(false)
  expect(shouldCleanMessage(false, 'replace')).toBe(false)
  expect(shouldCleanMessage(true, 'replace')).toBe(true)
  expect(shouldCleanMessage(true, 'reply')).toBe(true)
})
