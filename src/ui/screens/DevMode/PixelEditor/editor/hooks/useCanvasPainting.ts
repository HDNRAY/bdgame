import { useRef } from 'react'
import type { Dispatch, MouseEvent, PointerEvent, RefObject, SetStateAction } from 'react'
import { fillRegion, getCell, hitAnchor, moveAnchor, paintCell, paintLine } from '../../../../../pixel-sprites'
import type { HandAnchorData, PixelMap } from '../../../../../pixel-sprites'
import { SLOT_LABELS } from '../constants'
import type { Tool } from '../constants'
import type { AnchorOverride } from './useFrameAnchors'

export interface CanvasPaintingOptions {
    gridW: number
    gridH: number
    zoom: number
    tool: Tool
    slot: number
    mirror: boolean
    /** 锚点拖动模式（身体帧 + 拖锚点打开） */
    anchorMode: boolean
    anchorData: { main: HandAnchorData; off: HandAnchorData } | null
    poseName: string
    /** 事件回调里读当前数据用 */
    activeRef: RefObject<PixelMap>
    warnedTransparentRef: RefObject<boolean>
    setHover: Dispatch<SetStateAction<{ x: number; y: number } | null>>
    setActive: (next: PixelMap) => void
    setSlot: Dispatch<SetStateAction<number>>
    setTool: Dispatch<SetStateAction<Tool>>
    setStatus: Dispatch<SetStateAction<string>>
    setAnchorOverride: Dispatch<SetStateAction<AnchorOverride | null>>
    /** 落笔前记一步历史 */
    beginStroke: () => void
}

/**
 * 主画布上的指针交互：涂格/连线/油漆桶/吸管、锚点拖动、右键擦除。
 * 返回的回调原样挂到 <canvas> 上。
 */
export function useCanvasPainting({
    gridW,
    gridH,
    zoom,
    tool,
    slot,
    mirror,
    anchorMode,
    anchorData,
    poseName,
    activeRef,
    warnedTransparentRef,
    setHover,
    setActive,
    setSlot,
    setTool,
    setStatus,
    setAnchorOverride,
    beginStroke,
}: CanvasPaintingOptions) {
    const paintingRef = useRef(false)
    const lastCellRef = useRef<{ x: number; y: number } | null>(null)
    const anchorDragRef = useRef<{
        kind: 'main' | 'off'
        start: { x: number; y: number }
        main: HandAnchorData
        off: HandAnchorData
    } | null>(null)

    /**
     * 鼠标/指针事件 → 格坐标。用 offsetX/offsetY（相对 canvas 自身）+ clientWidth 换算：
     * 与元素在页面里的位置、滚动都无关，不会出现「点的位置漂移」。
     */
    const cellFromEvent = (e: {
        currentTarget: HTMLCanvasElement
        nativeEvent: { offsetX: number; offsetY: number }
    }): { x: number; y: number } | null => {
        const canvas = e.currentTarget
        const perCellX = (canvas.clientWidth || gridW * zoom) / gridW
        const perCellY = (canvas.clientHeight || gridH * zoom) / gridH
        const x = Math.floor(e.nativeEvent.offsetX / perCellX)
        const y = Math.floor(e.nativeEvent.offsetY / perCellY)
        if (x < 0 || x >= gridW || y < 0 || y >= gridH) return null
        return { x, y }
    }

    const applyCell = (c: { x: number; y: number }, from?: { x: number; y: number }) => {
        const value = tool === 'eraser' ? 0 : slot
        if (tool === 'fill') {
            setActive(fillRegion(activeRef.current, c.x, c.y, value))
            return
        }
        setActive(
            from
                ? paintLine(activeRef.current, from, c, value, { mirror })
                : paintCell(activeRef.current, c.x, c.y, value, { mirror }),
        )
    }

    const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
        const c = cellFromEvent(e)
        if (!c) return
        if (anchorMode && anchorData) {
            const kind = hitAnchor(anchorData.main, c, 1) ? 'main' : hitAnchor(anchorData.off, c, 1) ? 'off' : null
            if (!kind) return
            e.currentTarget.setPointerCapture(e.pointerId)
            anchorDragRef.current = { kind, start: c, main: anchorData.main, off: anchorData.off }
            return
        }
        if (tool === 'picker') {
            const picked = getCell(activeRef.current, c.x, c.y)
            setSlot(picked)
            setTool('pen')
            warnedTransparentRef.current = false
            setStatus(
                picked === 0
                    ? '吸管取到空白 —— 现在等于橡皮；想涂色请再选一个色块'
                    : `吸管取到 ${SLOT_LABELS[picked] ?? `颜色 ${picked}`}`,
            )
            return
        }
        if (tool === 'pen' && slot === 0 && !warnedTransparentRef.current) {
            warnedTransparentRef.current = true
            setStatus('当前是「透明」：涂上去就是擦掉')
        }
        e.currentTarget.setPointerCapture(e.pointerId)
        paintingRef.current = true
        beginStroke()
        applyCell(c)
        lastCellRef.current = c
    }

    const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
        const c = cellFromEvent(e)
        setHover(c)
        const drag = anchorDragRef.current
        if (anchorMode && drag) {
            if (!c) return
            const dx = c.x - drag.start.x
            const dy = c.y - drag.start.y
            const size = { w: gridW, h: gridH }
            setAnchorOverride({
                pose: poseName,
                main: drag.kind === 'main' ? moveAnchor(drag.main, dx, dy, size) : drag.main,
                off: drag.kind === 'off' ? moveAnchor(drag.off, dx, dy, size) : drag.off,
            })
            return
        }
        if (!paintingRef.current || !c) return
        const last = lastCellRef.current
        if (last && (last.x !== c.x || last.y !== c.y)) applyCell(c, last)
        else if (!last) applyCell(c)
        lastCellRef.current = c
    }

    const endStroke = () => {
        paintingRef.current = false
        lastCellRef.current = null
        anchorDragRef.current = null
    }

    const onPointerLeave = () => {
        endStroke()
        setHover(null)
    }

    const onContextMenu = (e: MouseEvent<HTMLCanvasElement>) => {
        e.preventDefault()
        const c = cellFromEvent(e)
        if (!c || anchorMode) return
        beginStroke()
        setActive(paintCell(activeRef.current, c.x, c.y, 0, { mirror: false }))
    }

    return { onPointerDown, onPointerMove, endStroke, onPointerLeave, onContextMenu }
}
