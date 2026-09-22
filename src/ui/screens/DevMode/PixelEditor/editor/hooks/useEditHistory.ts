import { useCallback, useRef, useState } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { PixelMap } from '../../../../../pixel-sprites'
import { HISTORY_LIMIT } from '../constants'
import type { EditSnapshot } from '../constants'
import { cloneMap } from '../utils'

/**
 * 撤销历史：画布 + 调色板一起存。
 * 只存画布会错位——删掉一个颜色后画布索引整体前移，若撤销只还原画布，
 * 索引就会指到已缩短的调色板上（颜色错乱）。
 */
export function useEditHistory(
    activeRef: RefObject<PixelMap>,
    weaponPaletteRef: RefObject<string[]>,
    setActive: (next: PixelMap) => void,
    setWeaponPalette: Dispatch<SetStateAction<string[]>>,
) {
    const historyRef = useRef<{ past: EditSnapshot[]; future: EditSnapshot[] }>({ past: [], future: [] })
    const [, bumpHistory] = useState(0)

    /** 记一步历史（画布 + 调色板）——画笔落笔、调色板增删改都调它 */
    const pushHistory = useCallback(() => {
        historyRef.current.past.push({ map: cloneMap(activeRef.current), palette: [...weaponPaletteRef.current] })
        if (historyRef.current.past.length > HISTORY_LIMIT) historyRef.current.past.shift()
        historyRef.current.future = []
        bumpHistory((v) => v + 1)
    }, [])

    const beginStroke = () => pushHistory()

    const undo = useCallback(() => {
        const h = historyRef.current
        const prev = h.past.pop()
        if (!prev) return
        h.future.push({ map: cloneMap(activeRef.current), palette: [...weaponPaletteRef.current] })
        setActive(prev.map)
        setWeaponPalette(prev.palette)
        bumpHistory((v) => v + 1)
    }, [setActive])

    const redo = useCallback(() => {
        const h = historyRef.current
        const next = h.future.pop()
        if (!next) return
        h.past.push({ map: cloneMap(activeRef.current), palette: [...weaponPaletteRef.current] })
        setActive(next.map)
        setWeaponPalette(next.palette)
        bumpHistory((v) => v + 1)
    }, [setActive])

    /** 载入 / 换模式 / 清存档时把历史清空 */
    const resetHistory = useCallback(() => {
        historyRef.current = { past: [], future: [] }
    }, [])

    return { pushHistory, beginStroke, undo, redo, resetHistory }
}
