import crypto from 'crypto'
import type { InlineQueryResult, MessageEntity } from 'grammy/types'
import { bot } from '../bot'
import { dbRepositories } from '../db'
import { hide_message } from '../handlers/hide_message'
import sqlit_character from '../handlers/sqlit_character'
import { findFirstSocialPost, resolveSocialMedia, socialMediaInlineResults } from '../media'
import { startsWithProcessedMarker } from '../telegram/processed-marker'
import { cleanUrlsInText, expandShortUrl } from '../url'

function article(id: string, title: string, text: string): InlineQueryResult {
  return {
    id,
    type: 'article',
    title,
    description: text.slice(0, 64),
    input_message_content: { message_text: text },
  }
}

function twitterVariants(text: string, fxtwitterTitle: string, vxtwitterTitle: string): InlineQueryResult[] {
  if (!text.includes('https://twitter.com/')) return []
  const display = `\u200C${text.replaceAll('https://twitter.com/', '\u200Chttps://twitter.com/')}`
  const entities: MessageEntity[] = []
  for (const match of display.matchAll(/\u200C(https:\/\/twitter\.com\/[^\s<>]+)/gu)) {
    entities.push({
      type: 'text_link',
      offset: match.index,
      length: 1,
      url: match[1].replace('twitter', 'vxtwitter').replace(/[.,!?，。！？、]+$/u, ''),
    })
  }
  const withHost = (host: string): MessageEntity[] => entities.map((entity) => entity.type === 'text_link'
    ? { ...entity, url: entity.url.replace('vxtwitter', host).split('/photo')[0] }
    : { ...entity })
  return [
    {
      id: 'fxtwitter-link', type: 'article', title: fxtwitterTitle, description: display.slice(0, 64),
      input_message_content: { message_text: display, entities: withHost('fxtwitter') },
    },
    {
      id: 'vxtwitter-link', type: 'article', title: vxtwitterTitle, description: display.slice(0, 64),
      input_message_content: { message_text: display, entities: withHost('c.vxtwitter') },
    },
  ]
}

function blueskyVariant(
  text: string,
  reference: Extract<ReturnType<typeof findFirstSocialPost>, { provider: 'bluesky' }>,
  title: string,
): InlineQueryResult {
  const target = `https://fxbsky.app/profile/${encodeURIComponent(reference.handle)}/post/${encodeURIComponent(reference.rkey)}`
  return {
    id: 'fxbluesky-link',
    type: 'article',
    title,
    description: text.slice(0, 64),
    input_message_content: {
      message_text: `\u200C${text}`,
      entities: [{ type: 'text_link', offset: 0, length: 1, url: target }],
    },
  }
}

bot.on('inline_query', async (ctx) => {
  const text = ctx.inlineQuery.query
  if (!text || text.startsWith('!s ')) {
    if (!text) {
      await ctx.answerInlineQuery([], {
        is_personal: true,
        cache_time: 0,
        button: { start_parameter: 'help', text: ctx.t('start').slice(0, 64) },
      })
    }
    return
  }
  const settings = dbRepositories().getOrCreateUserSettings(ctx.from.id)
  const alreadyProcessed = startsWithProcessedMarker(text)
  const cleaned = alreadyProcessed
    ? text
    : await cleanUrlsInText(text, {
      removeReferralMarketing: settings.removeReferralMarketing,
      expandShortUrls: settings.expandShortUrls,
      redirectResolver: settings.expandShortUrls ? expandShortUrl : undefined,
    })
  const normalizedTwitter = cleaned.replaceAll('https://x.com/', 'https://twitter.com/')
  const reference = findFirstSocialPost(cleaned)
  const results: InlineQueryResult[] = reference && settings.socialMediaEnabled && !alreadyProcessed
    ? socialMediaInlineResults(await resolveSocialMedia(reference), ctx.t)
    : []
  results.push(...twitterVariants(
    normalizedTwitter,
    ctx.t('inline-fxtwitter-title'),
    ctx.t('inline-vxtwitter-title'),
  ))
  if (reference?.provider === 'bluesky') {
    results.push(blueskyVariant(cleaned, reference, ctx.t('inline-fxbluesky-title')))
  }
  if (cleaned !== text) results.push(article('clean-url', ctx.t('inline-clean-title'), cleaned))
  results.push(...await hide_message({ text, mode: 'inline', type: 1 }, settings, ctx.t))
  const split = sqlit_character(text)
  results.push(split.length > 4000
    ? article('split-too-long', ctx.t('inline-too-long-title'), ctx.t('inline-too-long-body'))
    : article('split-character', ctx.t('inline-split-title'), split))
  results.push(article('md5', ctx.t('inline-md5-title'), crypto.createHash('md5').update(text).digest('hex')))
  const encoded = Buffer.from(text, 'utf8').toString('base64')
  if (encoded.length < 4000) results.push(article('base64-encode', ctx.t('inline-base64-encode-title'), encoded))
  const decoded = Buffer.from(text, 'base64').toString('utf8')
  if (decoded.length > 1) results.push(article('base64-decode', ctx.t('inline-base64-decode-title'), decoded))
  await ctx.answerInlineQuery(results.slice(0, 50), { is_personal: true, cache_time: 10 })
})
