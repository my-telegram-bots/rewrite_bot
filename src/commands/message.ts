import { MessageEntity } from 'telegraf/typings/core/types/typegram';
import { bot } from '../bot';
import { honsole } from '../handlers/common';
import { real_remove_utm } from '../handlers/remove_utm';

bot.on('text', async (ctx) => {
  let text = ctx.message.text
  if (ctx.message.entities && ctx.message.entities.length > 0) {
    let new_offset_list: number[] = []
    let new_length_list: number[] = []
    let entities: MessageEntity[] = [
      ...ctx.message.entities
    ]
    await Promise.all(entities.map(async (e: MessageEntity, i) => {
      e = { ...e }
      let offset = e.offset
      let length = e.length
      // @ts-ignore
      if (e.url) {
        // @ts-ignore
        e.url = await real_remove_utm(e.url)
      }
      // remove utm url in url will shorten the length and next offset need to be recalculated
      if (e.type === 'url') {
        let raw_url = ctx.message.text.substring(e.offset, e.offset + e.length)
        let rm_utm_url = await real_remove_utm(raw_url)
        text = text.replace(raw_url, rm_utm_url)
        length = rm_utm_url.length
      }
      new_offset_list[i] = offset
      new_length_list[i] = length
      entities[i] = e
    }))
    let lengthoffset = 0
    entities.forEach((e: MessageEntity, i) => {
      entities[i].length = new_length_list[i]
      entities[i].offset = new_offset_list[i] - lengthoffset
      // @ts-ignore
      lengthoffset += ctx.message.entities[i].length - new_length_list[i]
    })
    honsole.dev(1, ctx.message.text, JSON.stringify(ctx.message.entities))
    honsole.dev(2, text, JSON.stringify(entities))
    if (ctx.message.text !== text || JSON.stringify(ctx.message.entities) !== JSON.stringify(entities)) {
      await ctx.reply(text, {
        entities: entities,
        reply_to_message_id: ctx.message.message_id,
      })
    }
  }
})