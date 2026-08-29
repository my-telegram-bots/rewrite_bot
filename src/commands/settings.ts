import { bot } from '../bot'
import { ChatSettings, dbRepositories, UserSettings } from '../db'
import { chatSettingsPanel, isAdministrator, userSettingsPanel } from '../ui/settings-panel'

async function callerIsAdministrator(chatId: number, userId: number): Promise<boolean> {
  return isAdministrator(await bot.api.getChatMember(chatId, userId))
}

bot.command('settings', async (ctx) => {
  if (ctx.chat.type === 'private') {
    const panel = userSettingsPanel(dbRepositories().getOrCreateUserSettings(ctx.from!.id), ctx.t)
    await ctx.reply(panel.text, { reply_markup: panel.keyboard })
    return
  }
  const settings = dbRepositories().getOrCreateChatSettings(ctx.chat.id)
  const panel = chatSettingsPanel(settings, await callerIsAdministrator(ctx.chat.id, ctx.from!.id), ctx.t)
  await ctx.reply(panel.text, { reply_markup: panel.keyboard })
})

bot.callbackQuery(/^settings:/, async (ctx) => {
  const data = ctx.callbackQuery.data.split(':')
  const chat = ctx.callbackQuery.message?.chat
  if (!chat) {
    await ctx.answerCallbackQuery({ text: ctx.t('settings-panel-expired'), show_alert: true })
    return
  }
  if (data[1] === 'u') {
    if (chat.type !== 'private') {
      await ctx.answerCallbackQuery({ text: ctx.t('settings-panel-expired'), show_alert: true })
      return
    }
    const validUserAction = data.length === 3 && ['cleanup', 'short', 'media', 'referral', 'hide'].includes(data[2])
    const validUserMulti = data.length === 4 && data[2] === 'multi' && ['media_group', 'combine'].includes(data[3])
    if (!validUserAction && !validUserMulti) {
      await ctx.answerCallbackQuery({ text: ctx.t('settings-panel-expired'), show_alert: true })
      return
    }
    const current = dbRepositories().getOrCreateUserSettings(ctx.from.id)
    if (data[2] === 'multi' && data[3] === current.multiImageMode) {
      await ctx.answerCallbackQuery({ text: ctx.t('settings-saved') })
      return
    }
    const patch = data[2] === 'cleanup' ? { cleanupEnabled: !current.cleanupEnabled }
      : data[2] === 'short' ? { expandShortUrls: !current.expandShortUrls }
      : data[2] === 'media' ? { socialMediaEnabled: !current.socialMediaEnabled }
      : data[2] === 'multi' ? { multiImageMode: data[3] as UserSettings['multiImageMode'] }
      : data[2] === 'referral' ? { removeReferralMarketing: !current.removeReferralMarketing }
      : { hideMode: current.hideMode === 1 ? 2 : 1 }
    const panel = userSettingsPanel(dbRepositories().updateUserSettings(ctx.from.id, patch), ctx.t)
    await ctx.editMessageText(panel.text, { reply_markup: panel.keyboard })
    await ctx.answerCallbackQuery({ text: ctx.t('settings-saved') })
    return
  }
  if (chat.type === 'private') {
    await ctx.answerCallbackQuery({ text: ctx.t('settings-panel-expired'), show_alert: true })
    return
  }
  const validGroupAction = data.length === 3 && ['cleanup', 'short', 'media', 'referral'].includes(data[2])
  const validGroupMode = data.length === 4 && (
    (data[2] === 'mode' && ['replace', 'reply', 'off'].includes(data[3])) ||
    (data[2] === 'multi' && ['media_group', 'combine'].includes(data[3]))
  )
  if (!validGroupAction && !validGroupMode) {
    await ctx.answerCallbackQuery({ text: ctx.t('settings-panel-expired'), show_alert: true })
    return
  }
  if (!await callerIsAdministrator(chat.id, ctx.from!.id)) {
    await ctx.answerCallbackQuery({
      text: ctx.t('settings-admin-required'),
      show_alert: true,
    })
    return
  }
  const current = dbRepositories().getOrCreateChatSettings(chat.id)
  if ((data[2] === 'mode' && data[3] === current.mode) ||
    (data[2] === 'multi' && data[3] === current.multiImageMode)) {
    await ctx.answerCallbackQuery({ text: ctx.t('settings-saved') })
    return
  }
  const patch = data[2] === 'mode' ? { mode: data[3] as ChatSettings['mode'] }
    : data[2] === 'multi' ? { multiImageMode: data[3] as ChatSettings['multiImageMode'] }
    : data[2] === 'cleanup' ? { cleanupEnabled: !current.cleanupEnabled }
    : data[2] === 'short' ? { expandShortUrls: !current.expandShortUrls }
    : data[2] === 'media' ? { socialMediaEnabled: !current.socialMediaEnabled }
    : { removeReferralMarketing: !current.removeReferralMarketing }
  const panel = chatSettingsPanel(dbRepositories().updateChatSettings(chat.id, patch), true, ctx.t)
  await ctx.editMessageText(panel.text, { reply_markup: panel.keyboard })
  await ctx.answerCallbackQuery({ text: ctx.t('settings-saved') })
})
