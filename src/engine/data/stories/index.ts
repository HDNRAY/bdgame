import { XUANMEN } from './xuanmen'
import { VETERAN } from './veteran'
import { SECT } from './sect'
import { WANDERER } from './wanderer'
import { ORPHAN } from './orphan'
import { BLOOD_FEUD } from './blood_feud'
import type { Story } from '../../entities/story'

/** 所有可选故事 */
export const STORIES: Story[] = [XUANMEN, VETERAN, SECT, WANDERER, ORPHAN, BLOOD_FEUD]

/** 按 ID 查找故事 */
export function getStory(id: string): Story | undefined {
    return STORIES.find((s) => s.id === id)
}
