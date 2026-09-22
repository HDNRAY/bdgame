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
 *
 * 不需要存整张逐姿势表：所有可撤销操作都只改**当前这一个槽**
 * （`setActive` 只写当前槽），而且换槽/换武器/整块导入都会 `resetHistory()`，
 * 所以撤销永远发生在同一个槽里。历史上这里存过逐姿势表，那是为已经删掉的
 * 「复制当前→其它」（一次铺六个槽）准备的。
 */
export function useEditHistory(
    activeRef: RefObject<PixelMap>,
    weaponPaletteRef: RefObject<string[]>,
    setActive: (next: PixelMap) => void,
    setWeaponPalette: Dispatch<SetStateAction<string[]>>,
) {
    const historyRef = useRef<{ past: EditSnapshot[]; future: EditSnapshot[] }>({ past: [], future: [] })
    const [, bumpHistory] = useState(0)

    /** 记一份当前状态（画布 + 调色板） */
    const snapshot = useCallback(
        (): EditSnapshot => ({
            map: cloneMap(activeRef.current),
            palette: [...weaponPaletteRef.current],
        }),
        [activeRef, weaponPaletteRef],
    )

    const restore = useCallback(
        (snap: EditSnapshot) => {
            setActive(snap.map)
            setWeaponPalette(snap.palette)
        },
        [setActive, setWeaponPalette],
    )

    /** 记一步历史——画笔落笔、调色板增删改、粘贴都调它 */
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
