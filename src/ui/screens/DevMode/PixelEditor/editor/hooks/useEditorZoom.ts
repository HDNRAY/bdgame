import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_ZOOM, ZOOM_MAX, ZOOM_MIN } from '../constants'

/**
 * 自适应缩放（宽度和视口高度都要放得下）：测量主区域后取最大整数倍，
 * manualZoom 为 null 时用自动值（「适应」）。
 */
export function useEditorZoom(gridW: number, gridH: number, manualZoom: number | null) {
    const mainRef = useRef<HTMLDivElement>(null)
    const wrapRef = useRef<HTMLDivElement>(null)
    const [avail, setAvail] = useState<{ w: number; h: number } | null>(null)
    useLayoutEffect(() => {
        const el = mainRef.current
        if (!el) return
        const measure = () => {
            const rect = el.getBoundingClientRect()
            const top = wrapRef.current?.getBoundingClientRect().top ?? rect.top
            const viewportH = typeof window === 'undefined' ? 800 : window.innerHeight
            const w = Math.max(120, rect.width - 24)
            const h = Math.max(120, viewportH - top - 32)
            setAvail((prev) => (prev && Math.abs(prev.w - w) < 1 && Math.abs(prev.h - h) < 1 ? prev : { w, h }))
        }
        measure()
        const ro = new ResizeObserver(measure)
        ro.observe(el)
        window.addEventListener('resize', measure)
        return () => {
            ro.disconnect()
            window.removeEventListener('resize', measure)
        }
    }, [])
    const fitZoom = useMemo(() => {
        if (!avail) return DEFAULT_ZOOM
        return Math.max(ZOOM_MIN, Math.min(Math.floor(avail.w / gridW), Math.floor(avail.h / gridH), ZOOM_MAX))
    }, [avail, gridW, gridH])
    const autoFit = manualZoom === null
    const zoom = manualZoom ?? fitZoom

    return { mainRef, wrapRef, avail, fitZoom, autoFit, zoom }
}
