import { useMemo } from 'react'
import { buildPalette, getSpriteOutlineColor } from '../../../../../pixel-sprites'
import { CHARACTER_COLORS, DEFAULT_COLORS } from '../../../../../pixel-sprites/palette'
import type { CharacterColors } from '../../../../../pixel-sprites/palette'
import { useAppStore, getEffectiveTheme } from '../../../../../stores/app-store'
import { SLOT_FALLBACK_COLORS } from '../constants'

/**
 * 身体帧调色板：登记的角色配色 + 编辑器里的改动 + 固定槽位改动，
 * 缺槽位时补兜底色（missingSlots 用于面板提示）。
 */
export function useEditorPalette(
    charId: string,
    colorOverrides: Record<string, Partial<CharacterColors>>,
    fixedSlotOverrides: Record<number, string>,
) {
    const themeMode = useAppStore((s) => s.uiConfig.theme)
    const outlineColor = getSpriteOutlineColor(getEffectiveTheme(themeMode))
    /** 当前角色的有效配色（登记值 + 编辑器里的改动） */
    const baseColors: CharacterColors = CHARACTER_COLORS[charId] ?? DEFAULT_COLORS
    const effectiveColors: CharacterColors = { ...baseColors, ...(colorOverrides[charId] ?? {}) }
    const colorOverridden =
        Object.keys(colorOverrides[charId] ?? {}).length > 0 || Object.keys(fixedSlotOverrides).length > 0
    const charPalette = useMemo(() => {
        const base = buildPalette(charId, undefined, outlineColor, effectiveColors)
        const out: Record<string, string> = { ...base }
        for (const [slot, color] of Object.entries(fixedSlotOverrides)) out[slot] = color
        return out
    }, [charId, outlineColor, effectiveColors, fixedSlotOverrides])
    const { palette: framePalette, missingSlots } = useMemo(() => {
        const missing: number[] = []
        const merged: Record<string, string> = { ...charPalette }
        for (const [k, color] of Object.entries(SLOT_FALLBACK_COLORS)) {
            if (!merged[k]) {
                merged[k] = color
                missing.push(Number(k))
            }
        }
        return { palette: merged, missingSlots: missing }
    }, [charPalette])

    return { effectiveColors, colorOverridden, framePalette, missingSlots }
}
