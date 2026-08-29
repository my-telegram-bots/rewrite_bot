import { InlineKeyboard } from 'grammy'
import type { ChatMember } from 'grammy/types'
import { Translator } from '../context'
import { ChatSettings, UserSettings } from '../db'

function enabled(value: boolean, t: Translator): string {
  return t(value ? 'state-on' : 'state-off')
}

export function userSettingsPanel(settings: UserSettings, t: Translator): { text: string; keyboard: InlineKeyboard } {
  const style = t(settings.hideMode === 1 ? 'hide-style-character' : 'hide-style-single')
  const text = [
    t('user-settings-title'),
    `${t('cleanup-label')}: ${enabled(settings.cleanupEnabled, t)}`,
    `${t('short-links-label')}: ${enabled(settings.expandShortUrls, t)}`,
    `${t('social-media-label')}: ${enabled(settings.socialMediaEnabled, t)}`,
    `${t('referral-label')}: ${enabled(settings.removeReferralMarketing, t)}`,
    `${t('hide-style-label')}: ${style}`,
    t('user-settings-persisted'),
  ].join('\n')
  const keyboard = new InlineKeyboard()
    .text(t('button-cleanup', { state: enabled(settings.cleanupEnabled, t) }), 'settings:u:cleanup').row()
    .text(t('button-short-links', { state: enabled(settings.expandShortUrls, t) }), 'settings:u:short').row()
    .text(t('button-social-media', { state: enabled(settings.socialMediaEnabled, t) }), 'settings:u:media').row()
    .text(t('button-referral', { state: enabled(settings.removeReferralMarketing, t) }), 'settings:u:referral').row()
    .text(t('button-hide-style', { style }), 'settings:u:hide')
  return { text, keyboard }
}

export function chatSettingsPanel(
  settings: ChatSettings,
  mayEdit: boolean,
  t: Translator,
): { text: string; keyboard: InlineKeyboard } {
  const mode = t(`chat-mode-${settings.mode}`)
  const text = [
    t('chat-settings-title'),
    `${t('chat-mode-label')}: ${mode}`,
    `${t('cleanup-label')}: ${enabled(settings.cleanupEnabled, t)}`,
    `${t('short-links-label')}: ${enabled(settings.expandShortUrls, t)}`,
    `${t('social-media-label')}: ${enabled(settings.socialMediaEnabled, t)}`,
    `${t('referral-label')}: ${enabled(settings.removeReferralMarketing, t)}`,
    t('chat-replace-disclosure'),
    t(mayEdit ? 'chat-admin-can-edit' : 'chat-admin-view-only'),
  ].join('\n')
  const keyboard = new InlineKeyboard()
    .text(t('button-mode-replace', { selected: settings.mode === 'replace' ? '●' : '○' }), 'settings:g:mode:replace')
    .text(t('button-mode-reply', { selected: settings.mode === 'reply' ? '●' : '○' }), 'settings:g:mode:reply')
    .text(t('button-mode-off', { selected: settings.mode === 'off' ? '●' : '○' }), 'settings:g:mode:off').row()
    .text(t('button-cleanup', { state: enabled(settings.cleanupEnabled, t) }), 'settings:g:cleanup').row()
    .text(t('button-short-links', { state: enabled(settings.expandShortUrls, t) }), 'settings:g:short').row()
    .text(t('button-social-media', { state: enabled(settings.socialMediaEnabled, t) }), 'settings:g:media').row()
    .text(t('button-referral', { state: enabled(settings.removeReferralMarketing, t) }), 'settings:g:referral')
  return { text, keyboard }
}

export function isAdministrator(member: ChatMember): boolean {
  return member.status === 'administrator' || member.status === 'creator'
}
