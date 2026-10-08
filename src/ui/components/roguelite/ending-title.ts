import { ENDING_NAMES, ENDING_NAME_DEFAULT, ENDING_NAME_FALLEN } from '../../../data/story-intros'

/**
 * 结算标题：按结局旗标分辨（显示名统一在 `data/story-intros.ts`）。
 * 真局（`RogueliteScreen`）与 DevMode「结算页」预览共用同一处判定，避免两处各写一套。
 */
export function endingTitle(flags: Record<string, boolean | string | number>): string {
    if (flags['ending_true']) return ENDING_NAMES.true
    if (flags['ending_fallen']) return ENDING_NAME_FALLEN
    if (flags['ending_loop']) return ENDING_NAMES.loop
    return ENDING_NAME_DEFAULT
}
