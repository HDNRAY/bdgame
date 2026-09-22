import { useEffect } from 'react'
import { serializeEditorState } from '../../../../../pixel-sprites'
import type { PixelEditorSavedState } from '../../../../../pixel-sprites'
import { EDITOR_STATE_KEY } from '../constants'

/**
 * 写本地存档（防抖 400ms；拖笔时不至于每格都写一次）。
 * payload 用 useMemo 稳定（依赖 = 原 effect 的依赖表），所以防抖节奏与拆分前一致。
 */
export function useEditorAutosave(payload: PixelEditorSavedState) {
    useEffect(() => {
        const timer = window.setTimeout(() => {
            try {
                localStorage.setItem(EDITOR_STATE_KEY, serializeEditorState(payload))
            } catch {
                /* 存不下就算了，不影响编辑 */
            }
        }, 400)
        return () => window.clearTimeout(timer)
    }, [payload])
}
