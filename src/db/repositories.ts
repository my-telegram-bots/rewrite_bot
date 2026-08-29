import Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import {
  ChatSettings,
  ChatSettingsPatch,
  ConsumeHiddenMessageResult,
  DEFAULT_HIDE_PLACEHOLDERS,
  HiddenMessage,
  HiddenMessageCreate,
  HiddenNormalMessage,
  UserSettings,
  UserSettingsPatch,
} from './types'

type UserRow = {
  user_id: string
  cleanup_enabled: number
  expand_short_urls: number
  remove_referral_marketing: number
  social_media_enabled: number
  hide_mode: number
  hide_disabled: string
  expired_time_offset: number
}

type ChatRow = {
  chat_id: string
  cleanup_enabled: number
  expand_short_urls: number
  remove_referral_marketing: number
  social_media_enabled: number
  mode: ChatSettings['mode']
}

type HiddenRow = {
  id: string
  user_id: string
  text: string
  count: number
  max_count: number
  status: number
  time: number
  expired_time: number
}

function bool(value: number): boolean {
  return value === 1
}

export function telegramId(value: string | number | bigint): string {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) {
    throw new Error('Telegram identifiers must not be passed as unsafe JavaScript numbers')
  }
  const normalized = String(value)
  if (!/^-?\d+$/.test(normalized)) {
    throw new Error(`Invalid Telegram identifier: ${normalized}`)
  }
  return normalized
}

function hiddenFromRow(row: HiddenRow): HiddenMessage {
  return {
    id: row.id,
    userId: row.user_id,
    text: row.text,
    count: row.count,
    maxCount: row.max_count,
    status: row.status,
    time: row.time,
    expiredTime: row.expired_time,
  }
}

export class Repositories {
  constructor(private readonly db: Database.Database) {}

  getOrCreateUserSettings(userIdValue: string | number | bigint): UserSettings {
    const userId = telegramId(userIdValue)
    const create = this.db.transaction(() => {
      this.db.prepare('INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)').run(userId)
      const count = this.db.prepare(
        'SELECT COUNT(*) AS count FROM user_hide_placeholders WHERE user_id = ?',
      ).get(userId) as { count: number }
      if (count.count === 0) {
        const insert = this.db.prepare(
          'INSERT INTO user_hide_placeholders (user_id, position, placeholder) VALUES (?, ?, ?)',
        )
        DEFAULT_HIDE_PLACEHOLDERS.forEach((placeholder, position) => {
          insert.run(userId, position, placeholder)
        })
      }
    })
    create()
    return this.readUserSettings(userId)
  }

  updateUserSettings(
    userIdValue: string | number | bigint,
    patch: UserSettingsPatch,
  ): UserSettings {
    const userId = telegramId(userIdValue)
    const update = this.db.transaction(() => {
      const current = this.getOrCreateUserSettings(userId)
      this.db.prepare(`
        UPDATE user_settings SET
          cleanup_enabled = ?,
          expand_short_urls = ?,
          remove_referral_marketing = ?,
          social_media_enabled = ?,
          hide_mode = ?,
          hide_disabled = ?,
          expired_time_offset = ?
        WHERE user_id = ?
      `).run(
        Number(patch.cleanupEnabled ?? current.cleanupEnabled),
        Number(patch.expandShortUrls ?? current.expandShortUrls),
        Number(patch.removeReferralMarketing ?? current.removeReferralMarketing),
        Number(patch.socialMediaEnabled ?? current.socialMediaEnabled),
        patch.hideMode ?? current.hideMode,
        patch.hideDisabled ?? current.hideDisabled,
        patch.expiredTimeOffset ?? current.expiredTimeOffset,
        userId,
      )
      if (patch.hidePlaceholders) {
        if (patch.hidePlaceholders.length === 0 || patch.hidePlaceholders.some((item) => !item)) {
          throw new Error('At least one non-empty hide placeholder is required')
        }
        this.db.prepare('DELETE FROM user_hide_placeholders WHERE user_id = ?').run(userId)
        const insert = this.db.prepare(
          'INSERT INTO user_hide_placeholders (user_id, position, placeholder) VALUES (?, ?, ?)',
        )
        patch.hidePlaceholders.forEach((placeholder, position) => insert.run(userId, position, placeholder))
      }
    })
    update()
    return this.readUserSettings(userId)
  }

  private readUserSettings(userId: string): UserSettings {
    const row = this.db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId) as UserRow
    const placeholders = this.db.prepare(`
      SELECT placeholder FROM user_hide_placeholders WHERE user_id = ? ORDER BY position
    `).all(userId) as Array<{ placeholder: string }>
    return {
      userId: row.user_id,
      cleanupEnabled: bool(row.cleanup_enabled),
      expandShortUrls: bool(row.expand_short_urls),
      removeReferralMarketing: bool(row.remove_referral_marketing),
      socialMediaEnabled: bool(row.social_media_enabled),
      hideMode: row.hide_mode,
      hideDisabled: row.hide_disabled,
      expiredTimeOffset: row.expired_time_offset,
      hidePlaceholders: placeholders.map(({ placeholder }) => placeholder),
    }
  }

  getOrCreateChatSettings(chatIdValue: string | number | bigint): ChatSettings {
    const chatId = telegramId(chatIdValue)
    this.db.prepare('INSERT OR IGNORE INTO chat_settings (chat_id) VALUES (?)').run(chatId)
    return this.readChatSettings(chatId)
  }

  updateChatSettings(
    chatIdValue: string | number | bigint,
    patch: ChatSettingsPatch,
  ): ChatSettings {
    const chatId = telegramId(chatIdValue)
    const current = this.getOrCreateChatSettings(chatId)
    this.db.prepare(`
      UPDATE chat_settings SET
        cleanup_enabled = ?, expand_short_urls = ?, remove_referral_marketing = ?, social_media_enabled = ?, mode = ?
      WHERE chat_id = ?
    `).run(
      Number(patch.cleanupEnabled ?? current.cleanupEnabled),
      Number(patch.expandShortUrls ?? current.expandShortUrls),
      Number(patch.removeReferralMarketing ?? current.removeReferralMarketing),
      Number(patch.socialMediaEnabled ?? current.socialMediaEnabled),
      patch.mode ?? current.mode,
      chatId,
    )
    return this.readChatSettings(chatId)
  }

  private readChatSettings(chatId: string): ChatSettings {
    const row = this.db.prepare('SELECT * FROM chat_settings WHERE chat_id = ?').get(chatId) as ChatRow
    return {
      chatId: row.chat_id,
      cleanupEnabled: bool(row.cleanup_enabled),
      expandShortUrls: bool(row.expand_short_urls),
      removeReferralMarketing: bool(row.remove_referral_marketing),
      socialMediaEnabled: bool(row.social_media_enabled),
      mode: row.mode,
    }
  }

  createHiddenMessage(input: HiddenMessageCreate): HiddenMessage {
    const row: HiddenMessage = {
      id: input.id || randomUUID(),
      userId: telegramId(input.userId),
      text: input.text,
      count: 0,
      maxCount: input.maxCount ?? 0,
      status: input.status ?? 0,
      time: input.time ?? Math.floor(Date.now() / 1000),
      expiredTime: input.expiredTime ?? 0,
    }
    this.db.prepare(`
      INSERT INTO hidden_messages
        (id, user_id, text, count, max_count, status, time, expired_time)
      VALUES
        (@id, @userId, @text, @count, @maxCount, @status, @time, @expiredTime)
    `).run(row)
    return row
  }

  markHiddenMessageChosen(id: string): boolean {
    return this.db.prepare('UPDATE hidden_messages SET status = 1 WHERE id = ?').run(id).changes === 1
  }

  consumeHiddenMessage(id: string, now = Math.floor(Date.now() / 1000)): ConsumeHiddenMessageResult {
    const consume = this.db.transaction((): ConsumeHiddenMessageResult => {
      const row = this.db.prepare('SELECT * FROM hidden_messages WHERE id = ?').get(id) as HiddenRow | undefined
      if (!row) return { state: 'missing' }
      if (row.expired_time > 0 && row.expired_time <= now) return { state: 'expired' }
      if (row.max_count > 0 && row.count >= row.max_count) return { state: 'exhausted' }
      this.db.prepare('UPDATE hidden_messages SET count = count + 1, status = 1 WHERE id = ?').run(id)
      return { state: 'ok', message: hiddenFromRow({ ...row, count: row.count + 1, status: 1 }) }
    })
    return consume()
  }

  deleteHiddenMessagesForUser(userIdValue: string | number | bigint): number {
    return this.db.prepare('DELETE FROM hidden_messages WHERE user_id = ?').run(telegramId(userIdValue)).changes
  }

  cleanupHiddenMessages(now = Math.floor(Date.now() / 1000)): number {
    return this.db.prepare(`
      DELETE FROM hidden_messages
      WHERE (expired_time > 0 AND expired_time <= ?)
         OR (max_count > 0 AND count >= max_count)
         OR (status = 0 AND time <= ?)
    `).run(now, now - 600).changes
  }

  getHiddenNormalMessage(
    userIdValue: string | number | bigint,
    messageIdValue: string | number | bigint,
  ): HiddenNormalMessage | undefined {
    const row = this.db.prepare(`
      SELECT id, user_id, message_id, message_type, text, time
      FROM hidden_normal_messages WHERE user_id = ? AND message_id = ?
      ORDER BY time DESC, id DESC LIMIT 1
    `).get(telegramId(userIdValue), telegramId(messageIdValue)) as {
      id: string
      user_id: string
      message_id: string
      message_type: number
      text: string
      time: number
    } | undefined
    return row && {
      id: row.id,
      userId: row.user_id,
      messageId: row.message_id,
      messageType: row.message_type,
      text: row.text,
      time: row.time,
    }
  }

  createHiddenNormalMessage(message: HiddenNormalMessage): HiddenNormalMessage {
    const normalized = {
      ...message,
      userId: telegramId(message.userId),
      messageId: telegramId(message.messageId),
    }
    this.db.prepare(`
      INSERT INTO hidden_normal_messages (id, user_id, message_id, message_type, text, time)
      VALUES (@id, @userId, @messageId, @messageType, @text, @time)
    `).run(normalized)
    return normalized
  }
}
