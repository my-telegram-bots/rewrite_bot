import { i18n } from '../src/i18n'

test('official grammY i18n plugin loads synchronized English and Simplified Chinese resources', () => {
  expect(i18n.locales.sort()).toEqual(['en', 'zh-Hans'])
  expect(i18n.t('en', 'settings-admin-required')).toContain('SETTINGS_ADMIN_REQUIRED')
  expect(i18n.t('zh-Hans', 'settings-admin-required')).toContain('SETTINGS_ADMIN_REQUIRED')
  expect(i18n.t('en', 'clean-done', { count: 3 })).toContain('3')
  expect(i18n.t('zh-Hans', 'clean-done', { count: 3 })).toContain('3')
  expect(i18n.t('en', 'inline-media-failed-body')).toContain('MEDIA_LOOKUP_FAILED')
  expect(i18n.t('zh-Hans', 'inline-media-failed-body')).toContain('MEDIA_LOOKUP_FAILED')
  expect(i18n.t('en', 'inline-media-no-media-body')).toMatch(/text-only post.*MEDIA_NOT_FOUND/s)
  expect(i18n.t('zh-Hans', 'inline-media-no-media-body')).toMatch(/纯文本帖子.*MEDIA_NOT_FOUND/s)
  expect(i18n.t('en', 'inline-media-photo-title', { position: 1, total: 2 })).toContain('1/2')
  expect(i18n.t('zh-Hans', 'inline-media-photo-title', { position: 1, total: 2 })).toContain('1/2')
})
