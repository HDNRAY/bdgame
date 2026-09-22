import { useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { SPRITE_MAX_SLOT } from '../../../../../pixel-sprites'
import type { Tool } from '../constants'

export interface EditorHotkeysOptions {
    undo: () => void
    redo: () => void
    /** 当前槽位（[ ] 在它基础上加减） */
    slot: number
    selectSlot: (next: number) => void
    setTool: Dispatch<SetStateAction<Tool>>
    setMirror: Dispatch<SetStateAction<boolean>>
}

/** 编辑器快捷键：Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y、B/E/I/G、X、[ ]、0~9 */
export function useEditorHotkeys({ undo, redo, slot, selectSlot, setTool, setMirror }: EditorHotkeysOptions) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const el = e.target as HTMLElement | null
            if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return
            const mod = e.ctrlKey || e.metaKey
            if (mod && e.key.toLowerCase() === 'z') {
                e.preventDefault()
                if (e.shiftKey) redo()
                else undo()
                return
            }
            if (mod && e.key.toLowerCase() === 'y') {
                e.preventDefault()
                redo()
                return
            }
            if (mod) return
            const k = e.key.toLowerCase()
            if (k === 'b') setTool('pen')
            // E：画笔 ↔ 橡皮 一键来回切（和 PS 一样，不用鼠标去点按钮）
            else if (k === 'e') setTool((t) => (t === 'eraser' ? 'pen' : 'eraser'))
            else if (k === 'i') setTool('picker')
            else if (k === 'g') setTool('fill')
            else if (k === 'x') setMirror((v) => !v)
            else if (k === '[') selectSlot(Math.max(0, slot - 1))
            else if (k === ']') selectSlot(Math.min(SPRITE_MAX_SLOT, slot + 1))
            else if (/^[0-9]$/.test(k)) selectSlot(Number(k))
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [undo, redo, selectSlot, slot])
}
