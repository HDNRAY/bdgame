import { useCallback, useRef, useState } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { PixelMap } from '../../../../../pixel-sprites'
import { HISTORY_LIMIT } from '../constants'
import type { EditSnapshot } from '../constants'
import { cloneMap } from '../utils'

/** 整张逐姿势表的深拷贝 */
function clonePoses(poses: Record<string, PixelMap>): Record<string, PixelMap> {
    const out: Record<string, PixelMap> = {}
    for (const [pose, grid] of Object.entries(poses)) out[pose] = cloneMap(grid)
    return out
}

/**
 * 撤销历史：画布 + 调色板一起存，武器模式再带上整张逐姿势表。
 * 只存画布会错位——删掉一个颜色后画布索引整体前移，若撤销只还原画布，
 * 索引就会指到已缩短的调色板上（颜色错乱）。
 * 带逐姿势表是因为「复制当前→其它」一次会改六个槽，只还原当前槽等于撤销没生效。
 */
export function useEditHistory(
    activeRef: RefObject<PixelMap>,
    weaponPaletteRef: RefObject<string[]>,
    setActive: (next: PixelMap) => void,
    setWeaponPalette: Dispatch<SetStateAction<string[]>>,
    /** 武器模式的逐姿势表（可选）：传了就一起进快照 */
    posesRef?: RefObject<Record<string, PixelMap>>,
    setPoses?: Dispatch<SetStateAction<Record<string, PixelMap>>>,
) {
    const historyRef = useRef<{ past: EditSnapshot[]; future: EditSnapshot[] }>({ past: [], future: [] })
    const [, bumpHistory] = useState(0)

    /** 记一份当前状态（画布 + 调色板 + 可选的逐姿势表） */
    const snapshot = useCallback(
        (): EditSnapshot => ({
            map: cloneMap(activeRef.current),
            palette: [...weaponPaletteRef.current],
            poses: posesRef ? clonePoses(posesRef.current) : undefined,
        }),
        [posesRef],
    )

    const restore = useCallback(
        (snap: EditSnapshot) => {
            setActive(snap.map)
            setWeaponPalette(snap.palette)
            if (snap.poses && setPoses) setPoses(snap.poses)
        },
        [setActive, setPoses],
    )

    /** 记一步历史——画笔落笔、调色板增删改、批量铺图都调它 */
    const pushHistory = useCallback(() => {
        historyRef.current.past.push(snapshot())
        if (historyRef.current.past.length > HISTORY_LIMIT) historyRef.current.past.shift()
        historyRef.current.future = []
        bumpHistory((v) => v + 1)
    }, [snapshot])

    const beginStroke = () => pushHistory()

    const undo = useCallback(() => {
        const h = historyRef.current
        const prev = h.past.pop()
        if (!prev) return
        h.future.push(snapshot())
        restore(prev)
        bumpHistory((v) => v + 1)
    }, [snapshot, restore])

    const redo = useCallback(() => {
        const h = historyRef.current
        const next = h.future.pop()
        if (!next) return
        h.past.push(snapshot())
        restore(next)
        bumpHistory((v) => v + 1)
    }, [snapshot, restore])

    /** 载入 / 换模式 / 清存档时把历史清空 */
    const resetHistory = useCallback(() => {
        historyRef.current = { past: [], future: [] }
    }, [])

    return { pushHistory, beginStroke, undo, redo, resetHistory }
}
