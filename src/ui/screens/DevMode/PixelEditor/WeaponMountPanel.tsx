import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
    POSE_NAMES,
    WEAPON_OVERLAYS,
    getWeaponArt,
    weaponHasArt,
    WEAPON_POSES,
    formatWeaponPoseSnippet,
    baseAnchorHand,
    resolveWeaponMount,
    sharedOf,
    getSpriteOutlineColor,
    buildPalette,
} from '../../../pixel-sprites'
import type { PixelMap, WeaponPoseConfig, WeaponSlot } from '../../../pixel-sprites'
import { CHARACTER_COLORS, DEFAULT_COLORS } from '../../../pixel-sprites/palette'
import { SPRITES } from '../../../pixel-sprites/sprites'
import { dragHandOffset } from '../../../pixel-sprites/frame-edit'
import { PixelCanvas } from '../../../components/ui/PixelCanvas/PixelCanvas'
import { WEAPON_DB, getWeapon } from '../../../../data/weapons/weapons'
import { STARTING_WEAPONS } from '../../../../data/weapons/starting-weapons'
import { SearchSelect } from '../../../components/ui/SearchSelect/SearchSelect'
import { useAppStore, getEffectiveTheme } from '../../../stores/app-store'

/** 画布缩放的上下限（按可用区域自动取整数倍） */
const SCALE_MIN = 3
const SCALE_MAX = 12
/**
 * 视口：与 DevMode「像素图测试」/ CLI `npm run pixel` 一致——120×54，人物内容偏右（左边留 45 格）。
 * 否则挥砍类武器（attack 剑尖朝左）会画出画面外。
 */
const VIEW_COLS = 120
const VIEW_ROWS = 54
const VIEW_OFF_X = 45
const VIEW_OFF_Y = 3

const WEAPON_NAME: Record<string, string> = Object.fromEntries(
    [...WEAPON_DB, ...STARTING_WEAPONS].map((w) => [w.id, w.name]),
)
// 只画了逐姿势美术、没有通用图的武器也要能选（weaponHasArt 认两种）
const WEAPON_IDS = Object.keys(WEAPON_OVERLAYS).filter((id) => weaponHasArt(id))

const POSES = [...POSE_NAMES]

type PoseCfg = Partial<WeaponPoseConfig>

/** 各姿势的身体帧（显式列，避免用字符串索引 SpriteSet） */
const BODY_FRAMES: Record<string, PixelMap> = {
    idle: SPRITES.default.idle,
    attack: SPRITES.default.attack,
    dodge: SPRITES.default.dodge,
    parry: SPRITES.default.parry,
    hit: SPRITES.default.hit,
    buff: SPRITES.default.buff,
}

export interface WeaponMountPanelProps {
    /** 改过的挂点配置：武器 id → 槽位 → 姿势 → 配置（未改过的姿势不出现在这里） */
    configs: Record<string, Record<WeaponSlot, Record<string, PoseCfg>>>
    /** 写入一条配置；传 null 表示恢复武器文件里登记的挂点 */
    onChange: (weaponId: string, slot: WeaponSlot, pose: string, cfg: PoseCfg | null) => void
    charId: string
    setStatus: (msg: string) => void
    /** 初始编辑哪个槽位（默认主手） */
    initialSlot?: WeaponSlot
    /** 初始选中的武器（测试 / 深链用）；默认列表第一把 */
    initialWeaponId?: string
    /** 底板（透明区棋盘），与编辑器主画布共用 */
    backdrop?: { a: string; b: string }
}

/** 武器挂点 / 旋转的实验台：拖动改手部锚点，Shift（或右键）拖动绕握点旋转，导出 WEAPON_POSES 片段 */
export function WeaponMountPanel({
    configs,
    onChange,
    charId,
    setStatus,
    initialSlot = 'main',
    initialWeaponId,
    backdrop,
}: WeaponMountPanelProps) {
    const [weaponId, setWeaponId] = useState(initialWeaponId ?? WEAPON_IDS[0] ?? 'xiu_dong')
    const [pose, setPose] = useState('idle')
    /** 编辑哪个槽位：主手（表在 WEAPON_POSES[w][pose]）或副手（WEAPON_POSES[w].off[pose]） */
    const [slotState, setSlot] = useState<WeaponSlot>(initialSlot)
    /** 能不能挂副手：看引擎数据里的 one_handed 标签（长柄 polearm 之类不能双持 → 不显示副手槽） */
    const canOffhand = useMemo(() => {
        try {
            return getWeapon(weaponId).tags.includes('one_handed')
        } catch {
            return true // 引擎里查不到（比如纯测试用的临时 id）→ 保守显示
        }
    }, [weaponId])
    const isTwoHandedWeapon = !canOffhand
    /** 双手武器不能双持：没有副手槽，一律按主手编辑 */
    const slot: WeaponSlot = isTwoHandedWeapon ? 'main' : slotState

    // ── 画布自适应：铺满可用宽度（同时受视口高度限制），取整数倍保证像素清晰 ──
    const rootRef = useRef<HTMLDivElement>(null)
    const formRef = useRef<HTMLDivElement>(null)
    const canvasBoxRef = useRef<HTMLDivElement>(null)
    const [scale, setScale] = useState(5)
    useLayoutEffect(() => {
        const measure = () => {
            const root = rootRef.current
            const box = canvasBoxRef.current
            if (!root) return
            // 以「铺满可用宽度」为准（用户要的就是大图）；高度只用来兜底避免过分离谱：
            // 取宽高两者能给的倍数里更大的那个（即宁可按宽度放大，超出视口就滚动），上限 SCALE_MAX。
            const availW = root.clientWidth - 20
            const top = box?.getBoundingClientRect().top ?? root.getBoundingClientRect().top
            const viewportH = typeof window === 'undefined' ? 800 : window.innerHeight
            const availH = Math.max(120, viewportH - top - 40)
            const byWidth = Math.floor(availW / VIEW_COLS)
            const byHeight = Math.floor(availH / VIEW_ROWS)
            const s = Math.min(Math.max(byWidth, byHeight), SCALE_MAX)
            setScale(Math.max(SCALE_MIN, s))
        }
        measure()
        // 首帧后再量一次（表单换行/字体落定会改变画布顶部位置）
        const raf = window.requestAnimationFrame(measure)
        const ro = new ResizeObserver(measure)
        if (rootRef.current) ro.observe(rootRef.current)
        // 表单高度变了（换行、折叠展开）也要重算，否则会停在偏小的倍数
        if (formRef.current) ro.observe(formRef.current)
        window.addEventListener('resize', measure)
        return () => {
            window.cancelAnimationFrame(raf)
            ro.disconnect()
            window.removeEventListener('resize', measure)
        }
    }, [weaponId, pose, slot])

    const themeMode = useAppStore((s) => s.uiConfig.theme)
    const outlineColor = getSpriteOutlineColor(getEffectiveTheme(themeMode))
    const palette = useMemo(
        () => buildPalette(charId, undefined, outlineColor, CHARACTER_COLORS[charId] ?? DEFAULT_COLORS),
        [charId, outlineColor],
    )
    const bodyFrame = BODY_FRAMES[pose] ?? BODY_FRAMES.idle
    // 按当前姿势取图：逐姿势美术（刀鞘 vs 刀身）的握点相对位置不同，必须用这一姿势的那张
    const overlay = useMemo(() => getWeaponArt(weaponId, pose), [weaponId, pose])

    /**
     * 当前（武器 × 槽位 × 姿势）生效的配置：
     * 编辑器改过就用改过的，否则用引擎的解析结果（主手 = 登记值；副手 = 登记的 off 表或「副手默认」）。
     */
    const resolved = useMemo(() => resolveWeaponMount(weaponId, pose, { slot }), [weaponId, pose, slot])
    const rawRegistered = WEAPON_POSES[weaponId] ?? {}
    /**
     * 武器级覆盖：编辑器里改的「武器握点 / 镜像 / 锚定手」（写在主手 idle 上）只取**结构性字段**，
     * 叠到当前槽位/姿势的登记值上 —— 这样在任何姿势、任何槽位改这些，预览与导出都生效。
     */
    const baseOverlay = useMemo(
        // 槽位各有一套「本槽位共用」：主手写主手 idle，副手写副手 idle；副手没填的字段会继承主手（解析层合并规则）
        () => sharedOf((configs[weaponId]?.[slot]?.idle ?? {}) as PoseCfg),
        [configs, slot, weaponId],
    )
    const registered = useMemo(() => ({ ...resolved.config, ...baseOverlay }), [resolved, baseOverlay])
    /** 编辑器给当前（槽位×姿势）存的覆盖：只存「改过的字段」，不是整份快照 */
    const poseEntry = configs[weaponId]?.[slot]?.[pose]
    const effective = useMemo(
        () => (poseEntry ? { ...registered, ...poseEntry } : registered),
        [registered, poseEntry],
    )
    /**
     * 输入框只显示**本姿势覆盖里写的值**（空 = 没覆盖，用登记值）。
     * 生效值放在占位提示里 —— 这样「填 0」和「清空」都有明确含义：填 0 = 显式归零，清空 = 回到登记值。
     */
    const overrideValue = (key: keyof WeaponPoseConfig): number | undefined => {
        const v = poseEntry?.[key]
        return typeof v === 'number' ? v : undefined
    }
    const dirty = Boolean(configs[weaponId]?.[slot]?.[pose])
    const handBase = useMemo(() => baseAnchorHand(effective, pose, slot), [effective, pose, slot])
    const anchorHandTip =
        slot === 'off'
            ? '副手槽的落点固定用全局副手手位（OTHER_HAND_POINT），这个选项对副手槽没有作用'
            : '单手武器默认锚主手；选「副手」= 把这把武器锚到副手位（长柄武器在武器文件里已显式锚副手）'

    const patch = useCallback(
        (fields: PoseCfg) => {
            // 只存改过的字段：这样「武器共用」的设定（握点等）始终能透过姿势条目生效
            const next: PoseCfg = { ...(configs[weaponId]?.[slot]?.[pose] ?? {}), ...fields }
            // 旧的绝对坐标优先级高于偏移，会把偏移/拖拽"压住" → 一旦写偏移就清掉它
            if ('handDX' in fields || 'handDY' in fields) {
                delete next.handX
                delete next.handY
            }
            for (const k of Object.keys(next)) if (next[k as keyof PoseCfg] === undefined) delete next[k as keyof PoseCfg]
            onChange(weaponId, slot, pose, Object.keys(next).length ? next : null)
        },
        [configs, onChange, pose, slot, weaponId],
    )
    const clearField = useCallback(
        (key: keyof WeaponPoseConfig) => {
            const next: PoseCfg = { ...(configs[weaponId]?.[slot]?.[pose] ?? {}) }
            delete next[key]
            onChange(weaponId, slot, pose, Object.keys(next).length ? next : null)
        },
        [configs, onChange, pose, slot, weaponId],
    )

    /** 某槽位所有姿势的配置（导出用）：改过的用改过的，没改的用引擎解析值 */
    const tableFor = useCallback(
        (which: WeaponSlot) => {
            const out: Record<string, PoseCfg> = {}
            // 该槽位自己的「共用」覆盖（主手 idle / 副手 idle）
            const idleOverlay = sharedOf((configs[weaponId]?.[which]?.idle ?? {}) as PoseCfg)
            for (const p of POSES) {
                // 登记值打底，再叠该姿势的覆盖 —— 覆盖里没写的字段（角度、握点…）必须保留登记值，
                // 否则"只要这个姿势被编辑过，登记的角度/握点就丢"。
                const base = { ...resolveWeaponMount(weaponId, p, { slot: which }).config, ...idleOverlay }
                out[p] = { ...base, ...(configs[weaponId]?.[which]?.[p] ?? {}) }
            }
            return out
        },
        [configs, weaponId],
    )
    const snippet = useMemo(() => {
        const offEdited = Object.keys(configs[weaponId]?.off ?? {}).length > 0
        const offRegistered = Object.keys(rawRegistered.off ?? {}).length > 0
        // 非单手武器（长柄/双手重剑…）根本没有副手槽：导出里也不要出现 off 块
        const wantOff = canOffhand && (offEdited || offRegistered)
        return formatWeaponPoseSnippet(weaponId, tableFor('main'), POSES, {
            offTable: wantOff ? tableFor('off') : undefined,
        })
    }, [canOffhand, configs, weaponId, tableFor, rawRegistered])

    // ── 交互：拖动移动 / Shift（右键）拖动旋转 ──
    const overlayRef = useRef<HTMLCanvasElement>(null)
    const dragRef = useRef<{
        mode: 'move' | 'rotate' | 'target'
        startPointer: { x: number; y: number }
        startCfg: PoseCfg
        startAngle: number
        startTarget?: { x: number; y: number }
    } | null>(null)
    const [hover, setHover] = useState(false)

    const anchorHand = useMemo(
        () => resolveWeaponMount(weaponId, pose, { slot, config: effective }).hand,
        [weaponId, pose, slot, effective],
    )
    /** 配置角度 —— 只显示本姿势覆盖里写的值；生效角度见右栏读数 */
    const cfgAngleDeg = useMemo(() => {
        // 显示的是**配置角度**：覆盖 > 登记值 > 引擎默认规则（0° / 攻击 -45°）。
        // 镜像（flip）与角度无关，不会改变这个值，所以它可以直接写回配置。
        const a = overrideValue('angle') ?? effective.angle
        const deg = a !== undefined ? (a * 180) / Math.PI : pose === 'attack' ? -45 : 0
        return Math.round(deg * 10) / 10
    }, [effective, pose, poseEntry])

    /** 鼠标位置 → 精灵格坐标（视口 120×54，内容偏右 45 格 / 偏下 3 格，与 PixelCanvas 的 offX/offY 一致） */
    const toSprite = (e: { currentTarget: HTMLCanvasElement; clientX: number; clientY: number }) => {
        const rect = e.currentTarget.getBoundingClientRect()
        return {
            x: (e.clientX - rect.left) / (rect.width / VIEW_COLS) - VIEW_OFF_X,
            y: (e.clientY - rect.top) / (rect.height / VIEW_ROWS) - VIEW_OFF_Y,
        }
    }

    const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const p = toSprite(e)
        const rotate = e.shiftKey || e.button === 2
        e.currentTarget.setPointerCapture(e.pointerId)
        dragRef.current = {
            mode: rotate ? 'rotate' : 'move',
            startPointer: p,
            startCfg: effective,
            startAngle: resolveWeaponMount(weaponId, pose, { slot, config: effective }).angle,
        }
        setStatus(rotate ? '按住拖动：绕握点旋转（改角度）' : '拖动：移动武器（改手部锚点）')
    }

    const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const drag = dragRef.current
        if (!drag) return
        const p = toSprite(e)
        if (drag.mode === 'move') {
            const dx = Math.round((p.x - drag.startPointer.x) * 2) / 2
            const dy = Math.round((p.y - drag.startPointer.y) * 2) / 2
            const base = drag.startCfg
            // 拖动写「相对基准的偏移」（handDX/handDY），不再写绝对坐标 —— 导出也是相对值，
            // 这样基准（HAND_POINTS / 副手表）一改，武器跟着动。
            const startHand = resolveWeaponMount(weaponId, pose, { slot, config: base }).hand
            patch(dragHandOffset(base, pose, slot, startHand, dx, dy))
            return
        }
        // 旋转：从握点指向鼠标的角度差
        const anchor = resolveWeaponMount(weaponId, pose, { slot, config: drag.startCfg }).hand
        const a0 = Math.atan2(drag.startPointer.y - anchor.y, drag.startPointer.x - anchor.x)
        const a1 = Math.atan2(p.y - anchor.y, p.x - anchor.x)
        // 镜像的武器是「按 −angle 旋转再左右翻」画出来的（M·R(a) = R(−a)·M），
        // 所以屏幕上鼠标转多少，配置角度要反着写 —— 否则开着镜像拖动会反着转。
        const dir = drag.startCfg.flip ? -1 : 1
        let next = drag.startAngle + dir * (a1 - a0)
        // 收进 -180..180
        while (next > Math.PI) next -= Math.PI * 2
        while (next < -Math.PI) next += Math.PI * 2
        patch({ angle: Math.round(next * 10000) / 10000 })
    }

    const endDrag = () => {
        if (!dragRef.current) return
        dragRef.current = null
        setStatus(`挂点已改动 —— 用「复制挂点片段」导出 poses 块，粘进 weapons/entries/' + weaponId + '.ts`)
    }

    /** 交互层：握点 / 目标手十字标记（画在透明层上，不遮住像素） */
    const drawOverlay = useCallback(
        (canvas: HTMLCanvasElement | null) => {
            if (!canvas) return
            const ctx = canvas.getContext('2d')
            if (!ctx) return
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            const cross = (x: number, y: number, color: string, label: string) => {
                const cx = (x + VIEW_OFF_X + 0.5) * scale
                const cy = (y + VIEW_OFF_Y + 0.5) * scale
                ctx.strokeStyle = color
                ctx.lineWidth = 2
                ctx.beginPath()
                ctx.arc(cx, cy, scale * 0.9, 0, Math.PI * 2)
                ctx.stroke()
                ctx.beginPath()
                ctx.moveTo(cx - scale * 1.6, cy)
                ctx.lineTo(cx + scale * 1.6, cy)
                ctx.moveTo(cx, cy - scale * 1.6)
                ctx.lineTo(cx, cy + scale * 1.6)
                ctx.stroke()
                ctx.fillStyle = color
                ctx.font = `${scale * 2}px monospace`
                ctx.fillText(label, cx + scale * 1.8, cy - scale * 0.6)
            }
            cross(anchorHand.x, anchorHand.y, '#4ecdc4', '握')
        },
        [anchorHand, scale],
    )


    /**
     * 武器级握点：同一把武器（跨姿势、跨主副手）只有**一个**握点，写在主手 idle 上（= 导出片段里的
     * `...makePoses({ gripX, gripY })`）。姿势要单独调，用下面的「握点偏移」（gripDX/gripDY）。
     */
    /** 本槽位共用的登记值（副手未登记时，解析结果里已经是继承主手的值） */
    const slotShared = useMemo(() => resolveWeaponMount(weaponId, 'idle', { slot }).config, [weaponId, slot])
    const weaponGrip = useMemo(() => {
        const idleEdited = configs[weaponId]?.[slot]?.idle
        return { ...slotShared, ...(idleEdited ?? {}) }
    }, [configs, slot, slotShared, weaponId])
    /** 本槽位 idle 上写了的字段（空 = 用登记值；副手为空时 = 继承主手） */
    const slotIdleOverride = useCallback(
        (key: keyof WeaponPoseConfig): number | boolean | 'main' | 'off' | undefined =>
            configs[weaponId]?.[slot]?.idle?.[key],
        [configs, slot, weaponId],
    )
    const writeSlotIdle = useCallback(
        (key: keyof WeaponPoseConfig, value: unknown) => {
            const next: PoseCfg = { ...(configs[weaponId]?.[slot]?.idle ?? {}) }
            if (value === undefined || value === null) delete next[key]
            else (next as Record<string, unknown>)[key] = value
            onChange(weaponId, slot, 'idle', Object.keys(next).length ? next : null)
        },
        [configs, onChange, slot, weaponId],
    )
    const setWeaponGrip = useCallback(
        (key: 'gripX' | 'gripY', value: number | null) => {
            writeSlotIdle(key, value === null ? undefined : value)
            // 本槽位姿势条目里若还留着旧的绝对握点，会盖住新的槽位握点 → 清掉（姿势偏移 gripDX/gripDY 保留）
            for (const [p, cfg] of Object.entries(configs[weaponId]?.[slot] ?? {})) {
                if (p === 'idle') continue
                if (cfg.gripX === undefined && cfg.gripY === undefined) continue
                const cleaned: PoseCfg = { ...cfg }
                delete cleaned.gripX
                delete cleaned.gripY
                onChange(weaponId, slot, p, Object.keys(cleaned).length ? cleaned : null)
            }
        },
        [configs, onChange, slot, weaponId, writeSlotIdle],
    )
    /** 握点输入框显示的是「本槽位 idle 上写的值」（空 = 继承；副手空时继承主手） */
    const weaponGripOverride = (key: 'gripX' | 'gripY'): number | undefined => {
        const v = slotIdleOverride(key)
        return typeof v === 'number' ? v : undefined
    }
    /** 布尔三级下拉：undefined = 「自动」（该层没写覆盖，回落到下一层/引擎规则） */
    const boolSelect = (
        label: string,
        value: boolean | undefined,
        onPick: (v: boolean | undefined) => void,
        hint: string,
        onLabel = '是',
        offLabel = '否',
    ) => (
        <label className="pixel-editor-field pixel-editor-field--inline" title={hint}>
            <span>{label}</span>
            <select
                value={value === undefined ? 'auto' : value ? 'yes' : 'no'}
                onChange={(e) =>
                    onPick(e.target.value === 'auto' ? undefined : e.target.value === 'yes')
                }
            >
                <option value="auto">自动</option>
                <option value="yes">{onLabel}</option>
                <option value="no">{offLabel}</option>
            </select>
        </label>
    )

    /** 锚定手下拉：value=undefined 表示「自动」（该层没写覆盖，回落到下一层/引擎规则） */
    const anchorSelect = (
        label: string,
        value: 'main' | 'off' | undefined,
        onPick: (v: 'main' | 'off' | undefined) => void,
        hint: string,
    ) => (
        <label className="pixel-editor-field pixel-editor-field--inline" title={hint}>
            <span>{label}</span>
            <select
                value={value ?? 'auto'}
                disabled={slot === 'off'}
                onChange={(e) => onPick(e.target.value === 'auto' ? undefined : (e.target.value as 'main' | 'off'))}
            >
                <option value="auto">自动</option>
                <option value="main">主手</option>
                <option value="off">副手</option>
            </select>
        </label>
    )

    const weaponGripField = (label: string, key: 'gripX' | 'gripY', step = 0.5, hint = '') => (
        <label
            className="pixel-editor-num-field"
            title={`${hint || label}（${key}）：同一把武器只有一个握点（写在 poses 基底的 makePoses 里），跨姿势、跨主副手共用；姿势要单独调请用「握点偏移」`}
        >
            <span>{label}</span>
            <input
                type="number"
                step={step}
                value={weaponGripOverride(key) ?? ''}
                placeholder={typeof weaponGrip[key] === 'number' ? `登记 ${weaponGrip[key]}` : '武器握点'}
                onChange={(e) => setWeaponGrip(key, e.target.value === '' ? null : Number(e.target.value))}
            />
        </label>
    )

    /** 登记值（武器文件里那条配置）；用来做空字段的占位提示 */
    const registeredValue = (key: keyof WeaponPoseConfig): string => {
        // 偏移类：空 = 用文件里登记的偏移（没有就 0）；括号里给出基准位置方便对照
        if (key === 'handDX' || key === 'handDY') {
            const base = key === 'handDX' ? handBase.x : handBase.y
            const v = registered[key]
            return typeof v === 'number' ? `登记 ${v}（基准 ${base}）` : `0（基准 ${base}）`
        }
        if (key === 'gripDX' || key === 'gripDY') {
            const v = registered[key]
            return typeof v === 'number' ? `登记 ${v}` : '0'
        }
        const v = registered[key]
        if (v === undefined) return '自动'
        return `登记 ${typeof v === 'number' ? Math.round(v * 10000) / 10000 : String(v)}`
    }


    /** 偏移类字段：清空 = 0（显式归零）；其它字段：清空 = 回到文件里的登记值 / 自动规则 */
    const OFFSET_KEYS_IN_PANEL = ['handDX', 'handDY', 'gripDX', 'gripDY']
    const numField = (label: string, key: keyof WeaponPoseConfig, step = 0.5, hint = '') => {
        const isOffset = OFFSET_KEYS_IN_PANEL.includes(String(key))
        return (
            <label
                className="pixel-editor-num-field"
                title={`${hint || label}（${String(key)}）：留空 = ${isOffset ? '0（不偏移）' : '用武器文件里的登记值 / 引擎自动规则'}`}
            >
                <span>{label}</span>
                <input
                    type="number"
                    step={step}
                    value={overrideValue(key) ?? ''}
                    placeholder={registeredValue(key)}
                    onChange={(e) => {
                        const raw = e.target.value
                        if (raw === '') {
                            if (isOffset) patch({ [key]: 0 } as PoseCfg)
                            else clearField(key)
                        } else patch({ [key]: Number(raw) } as PoseCfg)
                    }}
                />
            </label>
        )
    }

    return (
        <div className="pixel-editor-mount" ref={rootRef}>
            <div className="pixel-editor-mount-form" ref={formRef}>
                {/* 第一栏：武器 + 姿势 */}
                <section className="pixel-editor-mount-col">
                    <h4 title="要调挂点的武器 / 当前正在编辑的姿势">武器 · 姿势</h4>
                    <div className="pixel-editor-field">
                        <span>武器</span>
                        <SearchSelect
                            value={weaponId}
                            options={WEAPON_IDS.map((id) => ({ value: id, label: WEAPON_NAME[id] ?? id }))}
                            onChange={setWeaponId}
                            searchPlaceholder="搜索武器…"
                        />
                    </div>
                    {isTwoHandedWeapon ? null : (
                    <div className="pixel-editor-slot-row">
                        <span className="pixel-editor-col-label" title="编辑哪个槽位的挂点：同一把武器可以主手、副手两套">
                            槽位
                        </span>
                        {(['main', 'off'] as const).map((s2) => (
                            <button
                                key={s2}
                                className={`pixel-editor-tool ${slot === s2 ? 'active' : ''}`}
                                title={
                                    s2 === 'main'
                                        ? '主手槽：配置写在 WEAPON_POSES[武器][姿势]'
                                        : '副手槽：配置写在 WEAPON_POSES[武器].off[姿势]；没登记时按「副手默认」画（全局副手手位 OTHER_HAND_POINT + 副手角度 DUAL_OFFHAND_ANGLE），改任一字段即写入 off 表'
                                }
                                onClick={() => setSlot(s2)}
                            >
                                {s2 === 'main' ? '主手' : '副手'}
                            </button>
                        ))}
                    </div>
                    )}
                    <div className="pixel-editor-pose-grid">
                        {POSES.map((p) => (
                            <button
                                key={p}
                                className={`pixel-editor-tool ${pose === p ? 'active' : ''}`}
                                title={`编辑 ${p} 姿势的${slot === 'off' ? '副手' : '主手'}挂点${configs[weaponId]?.[slot]?.[p] ? '（已改动）' : ''}`}
                                onClick={() => setPose(p)}
                            >
                                {p}
                            </button>
                        ))}

                    </div>
                    {/* ── 本槽位共用（跨姿势；主手 / 副手各有一套，副手没填就继承主手）── */}
                    <div className="pixel-editor-mount-group">
                        <span
                            className="pixel-editor-mount-group-title"
                            title={
                                slot === 'off'
                                    ? '副手槽自己的一套握点/镜像（写进武器文件的 off 子表基底）；没填的字段自动继承主手'
                                    : '主手槽自己的一套握点/镜像（写进武器文件的 poses 基底）；副手没填时会继承这里'
                            }
                        >
                            {slot === 'off' ? '副手共用' : '主手共用'}
                        </span>
                            <div className="pixel-editor-mount-grid">
                                {weaponGripField('握点 X', 'gripX', 0.5, '武器图内的握柄坐标（美术坐标 32×32）；本槽位共用（跨姿势）')}
                                {weaponGripField('握点 Y', 'gripY')}
                                {boolSelect(
                                    '镜像',
                                    slotIdleOverride('flip') as boolean | undefined,
                                    (v) => writeSlotIdle('flip', v),
                                    slot === 'off'
                                        ? '副手槽的镜像（沿过握点的竖轴左右翻转武器美术）；「自动」= 继承主手。某个姿势要单独调，就在下面「本姿势」里改'
                                        : '主手槽的镜像（沿过握点的竖轴左右翻转武器美术，手性颠倒，不改角度）。某个姿势要单独调，就在下面「本姿势」里改',
                                    '镜像',
                                    '不镜像',
                                )}
                                {anchorSelect(
                                    '锚定手',
                                    slotIdleOverride('anchorHand') as 'main' | 'off' | undefined,
                                    (v) => writeSlotIdle('anchorHand', v),
                                    '本槽位共用的锚定手；副手槽固定锚副手，所以这个选项只在主手槽有意义',
                                )}
                                {boolSelect(
                                    '手部覆盖',
                                    slotIdleOverride('handCover') as boolean | undefined,
                                    (v) => writeSlotIdle('handCover', v),
                                    slot === 'off'
                                        ? '副手槽默认是否盖「握着」的手部皮肤；「自动」= 继承主手。某个姿势要单独调，就在「本姿势」里改'
                                        : '本槽位默认是否盖「握着」的手部皮肤（写进 poses 基底）。拳套/护手这类"甲片本身就是手"的武器选「不覆盖」——手交给武器美术自己画。某个姿势要单独调，就在「本姿势」里改',
                                    '覆盖',
                                    '不覆盖',
                                )}
                            </div>
                        </div>
                </section>

                {/* 第二栏：挂点字段（自带握点 / 身上手位） */}
                <section className="pixel-editor-mount-col">
                    <h4 title="留空 = 用武器文件里的登记值；真正的自动值看右栏「当前」一行">挂点</h4>
                        {/* ── 本姿势 ── */}
                        <div className="pixel-editor-mount-group">
                            <span className="pixel-editor-mount-group-title" title={`下面这些只作用于当前姿势（${pose}）`}>
                                本姿势（{pose}）
                            </span>
                            <div className="pixel-editor-mount-grid">
                                                <label
                            className="pixel-editor-num-field"
                            title="配置倾角（度）。留空 = 自动（默认 0°、攻击 -45°）；镜像不改角度，最终角度看右栏读数"
                        >
                            <span>角度(度)</span>
                            <input
                                type="number"
                                step={1}
                                value={cfgAngleDeg}
                                placeholder={
                                    '清空 = 回到登记值'
                                }
                                onChange={(e) => {
                                    const raw = e.target.value
                                    if (raw === '') clearField('angle')
                                    else patch({ angle: Math.round(((Number(raw) * Math.PI) / 180) * 10000) / 10000 })
                                }}
                            />
                        </label>
                        {boolSelect(
                            '镜像',
                            poseEntry?.flip,
                            (v) => patch({ flip: v }),
                            '本姿势是否把武器左右镜像（沿过握点的竖轴翻转美术，手性颠倒，不改角度）；「自动」= 跟随「武器共用」里的设定',
                            '镜像',
                            '不镜像',
                        )}
                        {anchorSelect('锚定手', poseEntry?.anchorHand, (v) => patch({ anchorHand: v }), anchorHandTip)}
                        {boolSelect(
                            '手部覆盖',
                            poseEntry?.handCover,
                            (v) => patch({ handCover: v }),
                            '本姿势是否盖「握着」的手部皮肤；「自动」= 跟随「本槽位共用」里的设定',
                            '覆盖',
                            '不覆盖',
                        )}
                        {numField('握点偏移 X', 'gripDX', 0.5, '本姿势相对「武器握点」的偏移——要微调只用这个，不要改武器握点')}
                        {numField('握点偏移 Y', 'gripDY')}
                        {numField('挂点偏移 X', 'handDX', 0.5, '相对基准手位的偏移；拖动/输入的都是这个。基准见占位提示，最终落点看右栏「当前」一行')}
                        {numField('挂点偏移 Y', 'handDY')}
                            </div>
                        </div>
                </section>

                {/* 第三栏：开关 + 读数 + 操作 */}
                <section className="pixel-editor-mount-col">
                    <h4 title="整把武器共用（握点/镜像/锚定手）、当前落点读数、导出与重置">读数 · 导出</h4>
                    <div className="pixel-editor-row">
                        <button
                            className="pixel-editor-btn"
                            title="复制 poses 块（粘进 weapons/entries/<武器>.ts 里，与 overlay: 并列；整块替换）"
                            onClick={async () => {
                                try {
                                    await navigator.clipboard.writeText(snippet)
                                    setStatus('挂点片段已复制')
                                } catch {
                                    setStatus('挂点片段：剪贴板不可用，请从下面文本框手动复制')
                                }
                            }}
                        >
                            复制挂点片段
                        </button>
                        <button
                            className="pixel-editor-btn"
                            title="只把当前这个姿势的改动清掉，回到武器文件里的登记值"
                            disabled={!dirty}
                            onClick={() => {
                                onChange(weaponId, slot, pose, null)
                                setStatus(`${slot === 'off' ? '副手' : '主手'} ${pose} 已恢复为武器文件里的登记值`)
                            }}
                        >
                            恢复本姿势
                        </button>
                        <button
                            className="pixel-editor-btn"
                            title="本武器两个槽位、所有姿势的改动都清掉，回到武器文件里的登记值"
                            disabled={
                                Object.keys(configs[weaponId]?.main ?? {}).length === 0 &&
                                Object.keys(configs[weaponId]?.off ?? {}).length === 0
                            }
                            onClick={() => {
                                for (const p of POSES) {
                                    onChange(weaponId, 'main', p, null)
                                    onChange(weaponId, 'off', p, null)
                                }
                                setStatus(`「${WEAPON_NAME[weaponId] ?? weaponId}」两个槽位的挂点改动已清掉`)
                            }}
                        >
                            重置本武器
                        </button>
                    </div>
                    <details className="pixel-editor-code">
                        <summary title="展开看 WEAPON_POSES 的条目文本（剪贴板不可用时手动复制）">查看挂点代码</summary>
                        <textarea
                            className="pixel-editor-textarea pixel-editor-textarea--export"
                            readOnly
                            value={snippet}
                            rows={8}
                        />
                    </details>
                </section>
            </div>
            <div className="pixel-editor-mount-canvas" ref={canvasBoxRef}>
                <div className="pixel-editor-mount-stack" style={{ position: 'relative' }}>
                    <PixelCanvas
                        pixels={bodyFrame}
                        palette={palette}
                        scale={scale}
                        pose={pose}
                        weaponId={weaponId}
                        overlay={overlay}
                        poseConfig={effective}
                        backdrop={backdrop}
                        weaponSlot={slot}
                        canvasCols={VIEW_COLS}
                        canvasRows={VIEW_ROWS}
                        contentOffsetX={VIEW_OFF_X}
                        className="pixel-editor-mount-image"
                    />
                    <canvas
                        ref={(el) => {
                            overlayRef.current = el
                            drawOverlay(el)
                        }}
                        width={VIEW_COLS * scale}
                        height={VIEW_ROWS * scale}
                        className="pixel-editor-mount-overlay"
                        style={{ cursor: hover ? 'grab' : 'crosshair' }}
                        onPointerEnter={() => setHover(true)}
                        onPointerLeave={() => {
                            setHover(false)
                            endDrag()
                        }}
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={endDrag}
                        onContextMenu={(e) => e.preventDefault()}
                    />
                </div>
                <p className="pixel-editor-mount-tip">
                    画布上<b>拖动 = 移武器</b>（改手部锚点 handX/handY）；<b>Shift + 拖动</b>（或右键拖）={' '}
                    <b>绕握点旋转</b>（改角度）；<b>拖黄圈</b> = 单独挪第二握点（改目标手偏移，角度跟着变）。
                    青圈 = 握点，黄圈 = 第二握点（双手武器才有）。
                </p>
            </div>

        </div>
    )
}