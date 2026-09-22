/**
 * 像素编辑器的本地存档（纯函数部分）
 *
 * 为什么需要：把导出的片段粘回 `weapons.ts` / `sprites.ts` 保存后，Vite 会因为模块更新而整页重载，
 * 编辑器里的进度（正在改的那张图 + 调色板 + 各种开关）就没了。这里把它序列化进 localStorage，
 * 页面重载后自动恢复。
 *
 * 只做「解析 + 校验」的纯逻辑，读写 Storage 由组件负责（便于单测与 SSR）。
 */
import type { CharacterColors } from './palette'
import type { PixelMap, WeaponPoseConfig } from './types'
import { POSE_NAMES } from './weapons'

export type EditorMode = 'frame' | 'weapon' | 'mount'
export type EditorTool = 'pen' | 'eraser' | 'picker' | 'fill'

export interface PixelEditorSavedState {
    mode: EditorMode
    frame: {
        map: PixelMap
        constName: string
        poseName: string
        sourceKey: string
    }
    weapon: {
        id: string
        grid: PixelMap
        palette: string[]
    }
    /** 改过的角色配色（按角色 id；只存改动的槽位） */
    colorOverrides: Record<string, Partial<CharacterColors>>
    /** 改过的「固定槽位」颜色（1 描边 / 7 白 / 8 受击星光 / 9 金边），键是槽位号 */
    fixedSlotOverrides: Record<number, string>
    /** 武器挂点实验：武器 id → 槽位 → 姿势 → 改过的配置（只存出现过的字段） */
    mountConfigs: Record<string, Record<'main' | 'off', Record<string, Partial<WeaponPoseConfig>>>>
    tool: EditorTool
    slot: number
    mirror: boolean
    showGrid: boolean
    showAnchors: boolean
    manualZoom: number | null
}

const MODES: EditorMode[] = ['frame', 'weapon', 'mount']
const TOOLS: EditorTool[] = ['pen', 'eraser', 'picker', 'fill']

function isPixelMap(v: unknown): v is PixelMap {
    if (!Array.isArray(v) || v.length === 0) return false
    let width = -1
    for (const row of v) {
        if (!Array.isArray(row) || row.length === 0) return false
        if (width < 0) width = row.length
        else if (row.length !== width) return false
        for (const cell of row) {
            if (typeof cell !== 'number' || !Number.isInteger(cell) || cell < 0 || cell > 255) return false
        }
    }
    return true
}

/** 序列化（紧凑 JSON） */
export function serializeEditorState(state: PixelEditorSavedState): string {
    return JSON.stringify(state)
}

/**
 * 解析 + 校验存档；任何一处不合法都返回 null（宁可回到默认状态，也不要半截脏数据）。
 */
export function parseEditorState(text: string | null | undefined): PixelEditorSavedState | null {
    if (!text) return null
    let raw: unknown
    try {
        raw = JSON.parse(text)
    } catch {
        return null
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    const s = raw as Record<string, unknown>
    const mode = s.mode
    const tool = s.tool
    if (typeof mode !== 'string' || !MODES.includes(mode as EditorMode)) return null
    if (typeof tool !== 'string' || !TOOLS.includes(tool as EditorTool)) return null

    const frame = s.frame as Record<string, unknown> | undefined
    const weapon = s.weapon as Record<string, unknown> | undefined
    if (!frame || !weapon) return null
    if (!isPixelMap(frame.map)) return null
    if (!isPixelMap(weapon.grid)) return null
    if (!Array.isArray(weapon.palette) || weapon.palette.some((c) => typeof c !== 'string')) return null
    if (typeof frame.constName !== 'string' || typeof frame.poseName !== 'string') return null
    if (typeof frame.sourceKey !== 'string') return null
    if (typeof weapon.id !== 'string') return null

    const rawOverrides = s.colorOverrides
    const colorOverrides: Record<string, Partial<CharacterColors>> = {}
    if (rawOverrides && typeof rawOverrides === 'object' && !Array.isArray(rawOverrides)) {
        const KEYS: (keyof CharacterColors)[] = ['skin', 'hair', 'eyes', 'accent', 'decoration']
        for (const [charId, v] of Object.entries(rawOverrides as Record<string, unknown>)) {
            if (!v || typeof v !== 'object' || Array.isArray(v)) return null
            const entry: Partial<CharacterColors> = {}
            for (const k of KEYS) {
                const color = (v as Record<string, unknown>)[k]
                if (color === undefined) continue
                if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) return null
                entry[k] = color
            }
            colorOverrides[charId] = entry
        }
    }

    const rawFixed = s.fixedSlotOverrides
    const fixedSlotOverrides: Record<number, string> = {}
    if (rawFixed && typeof rawFixed === 'object' && !Array.isArray(rawFixed)) {
        for (const [k, v] of Object.entries(rawFixed as Record<string, unknown>)) {
            const slot = Number(k)
            if (!Number.isInteger(slot) || slot < 1 || slot > 9) return null
            if (typeof v !== 'string' || !/^#[0-9a-f]{6}$/i.test(v)) return null
            fixedSlotOverrides[slot] = v
        }
    }

    const rawMount = s.mountConfigs
    const mountConfigs: Record<string, Record<'main' | 'off', Record<string, Partial<WeaponPoseConfig>>>> = {}
    if (rawMount && typeof rawMount === 'object' && !Array.isArray(rawMount)) {
        const NUMERIC: (keyof WeaponPoseConfig)[] = [
            'gripX',
            'gripY',
            'grip2X',
            'grip2Y',
            'handX',
            'handY',
            'handDX',
            'handDY',
            'targetX',
            'targetY',
            'targetDX',
            'targetDY',
            'angle',
        ]
        for (const [weaponId, bySlot] of Object.entries(rawMount as Record<string, unknown>)) {
            if (!bySlot || typeof bySlot !== 'object' || Array.isArray(bySlot)) return null
            // 兼容旧存档（v1 是「武器 → 姿势 → 配置」，没有槽位那一层）：整体当主手
            const obj = bySlot as Record<string, unknown>
            const looksLikeSlots = 'main' in obj || 'off' in obj
            const slots: Record<string, unknown> = looksLikeSlots
                ? obj
                : { main: obj }
            const merged: Record<'main' | 'off', Record<string, Partial<WeaponPoseConfig>>> = { main: {}, off: {} }
            for (const [slotName, poses] of Object.entries(slots)) {
                if (slotName !== 'main' && slotName !== 'off') return null
                if (!poses || typeof poses !== 'object' || Array.isArray(poses)) return null
                const entries: Record<string, Partial<WeaponPoseConfig>> = {}
                for (const [pose, cfg] of Object.entries(poses as Record<string, unknown>)) {
                // 姿势名必须在白名单里（'move' 是渲染器会用到的姿势：编辑器不编辑它，但允许存在）
                if (!(POSE_NAMES as readonly string[]).includes(pose) && pose !== 'move') return null
                if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) return null
                const out: Record<string, unknown> = {}
                for (const k of NUMERIC) {
                    const v = (cfg as Record<string, unknown>)[k]
                    if (v === undefined) continue
                    if (typeof v !== 'number' || !Number.isFinite(v)) return null
                    out[k] = v
                }
                const flip = (cfg as Record<string, unknown>).flip
                if (flip !== undefined) {
                    if (typeof flip !== 'boolean') return null
                    out.flip = flip
                }
                const noHandCover = (cfg as Record<string, unknown>).noHandCover
                if (noHandCover !== undefined) {
                    if (typeof noHandCover !== 'boolean') return null
                    out.noHandCover = noHandCover
                }
                const anchorHand = (cfg as Record<string, unknown>).anchorHand
                if (anchorHand !== undefined) {
                    if (anchorHand !== 'main' && anchorHand !== 'off') return null
                    out.anchorHand = anchorHand
                }
                    entries[pose] = out as Partial<WeaponPoseConfig>
                }
                merged[slotName] = entries
            }
            mountConfigs[weaponId] = merged
        }
    }

    const slot = s.slot
    if (typeof slot !== 'number' || !Number.isInteger(slot) || slot < 0 || slot > 255) return null
    const manualZoom = s.manualZoom
    if (manualZoom !== null && (typeof manualZoom !== 'number' || !Number.isFinite(manualZoom))) return null

    return {
        mode: mode as EditorMode,
        frame: {
            map: frame.map,
            constName: frame.constName,
            poseName: frame.poseName,
            sourceKey: frame.sourceKey,
        },
        weapon: {
            id: weapon.id,
            grid: weapon.grid,
            palette: weapon.palette as string[],
        },
        colorOverrides,
        fixedSlotOverrides,
        mountConfigs,
        tool: tool as EditorTool,
        slot,
        mirror: Boolean(s.mirror),
        showGrid: Boolean(s.showGrid),
        showAnchors: Boolean(s.showAnchors),
        manualZoom: manualZoom as number | null,
    }
}
