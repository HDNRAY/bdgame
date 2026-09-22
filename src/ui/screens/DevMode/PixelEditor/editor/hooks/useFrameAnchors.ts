import { useMemo } from 'react'
import {
    HAND_COVER,
    HAND_POINTS,
    LEFT_HAND_COVER,
    OTHER_HAND_POINT,
    SPRITE_PAD_LEFT,
    formatAnchorSnippet,
} from '../../../../../pixel-sprites'
import type { HandAnchorData } from '../../../../../pixel-sprites'
import type { EditorMode } from '../constants'

/** 编辑器里改过、但还没落回 weapons/hands.ts 的锚点 */
export interface AnchorOverride {
    pose: string
    main: HandAnchorData
    off: HandAnchorData
}

/** 画布上要画的锚点格（遮罩 + 握点） */
export interface AnchorCell {
    x: number
    y: number
    kind: 'main' | 'off'
}

export interface AnchorCells {
    cover: AnchorCell[]
    grip: AnchorCell[]
}

/**
 * 身体帧的手部锚点数据：从 weapons/hands.ts 的四张表读登记值（把渲染留白减掉），
 * 编辑器里拖动/吸附过的用 anchorOverride 覆盖，并算出画布高亮格与导出片段。
 */
export function useFrameAnchors(
    mode: EditorMode,
    poseName: string,
    anchorEdit: boolean,
    anchorOverride: AnchorOverride | null,
) {
    const registeredAnchor = useMemo(() => {
        if (mode !== 'frame') return null
        const toPoint = (p: { x: number; y: number } | undefined) =>
            p ? { x: p.x - SPRITE_PAD_LEFT, y: p.y } : { x: 0, y: 0 }
        const toCover = (cells: [number, number][] | undefined): [number, number][] =>
            (cells ?? []).map(([x, y]) => [x - SPRITE_PAD_LEFT, y] as [number, number])
        if (!(poseName in HAND_POINTS) && !(poseName in HAND_COVER)) return null
        return {
            main: { point: toPoint(HAND_POINTS[poseName]), cover: toCover(HAND_COVER[poseName]) },
            off: { point: toPoint(OTHER_HAND_POINT[poseName]), cover: toCover(LEFT_HAND_COVER[poseName]) },
        }
    }, [mode, poseName])
    const anchorData = useMemo(() => {
        if (mode !== 'frame') return null
        if (anchorOverride && anchorOverride.pose === poseName) {
            return { main: anchorOverride.main, off: anchorOverride.off }
        }
        return registeredAnchor
    }, [mode, anchorOverride, poseName, registeredAnchor])
    const anchorDirty = Boolean(anchorOverride && anchorOverride.pose === poseName)
    const anchorMode = anchorEdit && Boolean(anchorData)
    const anchorCells = useMemo<AnchorCells>(() => {
        if (!anchorData) return { cover: [], grip: [] }
        const cover: AnchorCell[] = []
        for (const [x, y] of anchorData.main.cover) cover.push({ x, y, kind: 'main' })
        for (const [x, y] of anchorData.off.cover) cover.push({ x, y, kind: 'off' })
        return {
            cover,
            grip: [
                { x: Math.round(anchorData.main.point.x), y: Math.round(anchorData.main.point.y), kind: 'main' as const },
                { x: Math.round(anchorData.off.point.x), y: Math.round(anchorData.off.point.y), kind: 'off' as const },
            ],
        }
    }, [anchorData])
    const anchorSnippet = useMemo(
        () =>
            anchorData
                ? formatAnchorSnippet(poseName, anchorData.main, anchorData.off)
                : `// 姿势 ${poseName} 在武器文件里还没有登记锚点`,
        [anchorData, poseName],
    )

    return { anchorData, anchorDirty, anchorMode, anchorCells, anchorSnippet }
}
