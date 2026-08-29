export const DEFAULT_HIDE_PLACEHOLDERS = ['█', '❔', '❓'] as const
export type MultiImageMode = 'media_group' | 'combine'

export interface UserSettings {
  userId: string
  cleanupEnabled: boolean
  expandShortUrls: boolean
  removeReferralMarketing: boolean
  socialMediaEnabled: boolean
  multiImageMode: MultiImageMode
  hideMode: number
  hideDisabled: string
  expiredTimeOffset: number
  hidePlaceholders: string[]
}

export type ChatMode = 'replace' | 'reply' | 'off'

export interface ChatSettings {
  chatId: string
  cleanupEnabled: boolean
  expandShortUrls: boolean
  removeReferralMarketing: boolean
  socialMediaEnabled: boolean
  multiImageMode: MultiImageMode
  mode: ChatMode
}

export interface HiddenMessage {
  id: string
  userId: string
  text: string
  count: number
  maxCount: number
  status: number
  time: number
  expiredTime: number
}

export interface HiddenNormalMessage {
  id: string
  userId: string
  messageId: string
  messageType: number
  text: string
  time: number
}

export interface HiddenMessageCreate {
  id?: string
  userId: string
  text: string
  maxCount?: number
  status?: number
  time?: number
  expiredTime?: number
}

export type UserSettingsPatch = Partial<Omit<UserSettings, 'userId' | 'hidePlaceholders'>> & {
  hidePlaceholders?: string[]
}

export type ChatSettingsPatch = Partial<Omit<ChatSettings, 'chatId'>>

export type ConsumeHiddenMessageResult =
  | { state: 'ok'; message: HiddenMessage }
  | { state: 'missing' | 'expired' | 'exhausted' }
