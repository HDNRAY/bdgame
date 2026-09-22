import { useEffect, useMemo, useState } from 'react'
import { BACKDROP_PRESETS, BACKDROP_STORAGE_KEY } from '../constants'
import { backdropPartner, isLightColor } from '../utils'

/**
 * 画布底板色系：记住上次选择（localStorage），自定义色由基色推出棋盘的另一格。
 * 返回的 backdrop 供主画布 / 预览 / 挂点面板共用。
 */
export function useBackdrop() {
    const [backdropId, setBackdropId] = useState<string>(() => {
        try {
            const saved = localStorage.getItem(BACKDROP_STORAGE_KEY)
            if (saved) {
                const [id, color] = saved.split('|')
                if (BACKDROP_PRESETS.some((p) => p.id === id)) return id
                void color
            }
        } catch {
            /* 忽略 */
        }
        return 'dark'
    })
    const [customBackdrop, setCustomBackdrop] = useState<string>(() => {
        try {
            const saved = localStorage.getItem(BACKDROP_STORAGE_KEY)
            const color = saved?.split('|')[1]
            if (color && /^#[0-9a-f]{6}$/i.test(color)) return color
        } catch {
            /* 忽略 */
        }
        return '#2b3a2b'
    })
    const backdrop = useMemo(() => {
        const preset = BACKDROP_PRESETS.find((p) => p.id === backdropId) ?? BACKDROP_PRESETS[0]
        if (preset.id !== 'custom') return { a: preset.a, b: preset.b }
        return { a: customBackdrop, b: backdropPartner(customBackdrop) }
    }, [backdropId, customBackdrop])
    useEffect(() => {
        try {
            localStorage.setItem(BACKDROP_STORAGE_KEY, `${backdropId}|${customBackdrop}`)
        } catch {
            /* 忽略 */
        }
    }, [backdropId, customBackdrop])
    const lightBackdrop = isLightColor(backdrop.a)

    return { backdropId, setBackdropId, customBackdrop, setCustomBackdrop, backdrop, lightBackdrop }
}
