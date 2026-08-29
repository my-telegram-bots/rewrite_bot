import type { MessageEntity } from 'grammy/types'
import { cleanUrl } from './clean'
import { CleanUrlOptions } from './types'

interface TextEdit {
  start: number
  end: number
  replacement: string
}

export interface CleanEntitiesResult {
  text: string
  entities: MessageEntity[]
  changed: boolean
}

function mapPosition(position: number, edits: TextEdit[]): number {
  let mapped = position
  for (const edit of edits) {
    if (position >= edit.end) {
      mapped += edit.replacement.length - (edit.end - edit.start)
    } else if (position > edit.start) {
      mapped += Math.min(position - edit.start, edit.replacement.length) - (position - edit.start)
    }
  }
  return mapped
}

export async function cleanTelegramEntities(
  text: string,
  sourceEntities: readonly MessageEntity[],
  options: CleanUrlOptions = {},
): Promise<CleanEntitiesResult> {
  const entities = sourceEntities.map((entity) => ({ ...entity })) as MessageEntity[]
  const edits: TextEdit[] = []
  let targetChanged = false

  for (let index = 0; index < entities.length; index += 1) {
    const entity = entities[index]
    if (entity.type === 'text_link') {
      const result = await cleanUrl(entity.url, options)
      if (result.cleanedUrl !== entity.url) {
        entities[index] = { ...entity, url: result.cleanedUrl }
        targetChanged = true
      }
    } else if (entity.type === 'url') {
      const original = text.slice(entity.offset, entity.offset + entity.length)
      const result = await cleanUrl(original, options)
      if (result.cleanedUrl !== original) {
        edits.push({ start: entity.offset, end: entity.offset + entity.length, replacement: result.cleanedUrl })
      }
    }
  }

  edits.sort((a, b) => a.start - b.start)
  for (let index = 1; index < edits.length; index += 1) {
    if (edits[index].start < edits[index - 1].end) throw new Error('Overlapping Telegram URL entities are invalid')
  }

  let rebuilt = text
  for (const edit of [...edits].reverse()) {
    rebuilt = rebuilt.slice(0, edit.start) + edit.replacement + rebuilt.slice(edit.end)
  }
  for (let index = 0; index < entities.length; index += 1) {
    const entity = entities[index]
    const oldEnd = entity.offset + entity.length
    const newOffset = mapPosition(entity.offset, edits)
    entities[index] = {
      ...entity,
      offset: newOffset,
      length: mapPosition(oldEnd, edits) - newOffset,
    }
  }
  return { text: rebuilt, entities, changed: edits.length > 0 || targetChanged }
}
