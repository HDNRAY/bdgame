import { FEUD } from './feud'
import { SECT } from './sect'
import { XUANMEN } from './xuanmen'
import { VETERAN } from './veteran'
import { WANDERER } from './wanderer'
import type { StoryDef } from '../../game/entities/story'

export const STORIES: StoryDef[] = [FEUD, SECT, XUANMEN, VETERAN, WANDERER]

export function getStory(id?: string): StoryDef | undefined {
    return STORIES.find((s) => s.id === id)
}
