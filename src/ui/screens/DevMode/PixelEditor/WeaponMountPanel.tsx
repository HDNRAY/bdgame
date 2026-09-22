import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
    OTHER_HAND_POINT,
    POSE_NAMES,
    WEAPON_OVERLAYS,
    WEAPON_POSES,
    formatWeaponPoseSnippet,
    baseAnchorHand,
    baseTargetHand,
    poseConfigIn,
    resolveWeaponMount,
    getSpriteOutlineColor,
    buildPalette,
} from '../../../pixel-sprites'
import type { PixelMap, WeaponPoseConfig, WeaponSlot } from '../../../pixel-sprites'
import { CHARACTER_COLORS, DEFAULT_COLORS } from '../../../pixel-sprites/palette'
import { SPRITES } from '../../../pixel-sprites/sprites'
import { dragHandOffset, dragTargetOffset } from '../../../pixel-sprites/frame-edit'
import { PixelCanvas } from '../../../components/ui/PixelCanvas/PixelCanvas'
import { WEAPON_DB } from '../../../../data/weapons/weapons'
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
const WEAPON_IDS = Object.keys(WEAPON_OVERLAYS).filter((id) => (WEAPON_OVERLAYS[id]?.pixels.length ?? 0) > 0)

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
    /** 写入一条配置；传 null 表示恢复 weapons.ts 的登记值 */
    onChange: (weaponId: string, slot: WeaponSlot, pose: string, cfg: PoseCfg | null) => void
    charId: string
    setStatus: (msg: string) => void
    /** 初始编辑哪个槽位（默认主手） */
    initialSlot?: WeaponSlot
}

/** 武器挂点 / 旋转的实验台：拖动改手部锚点，Shift（或右键）拖动绕握点旋转，导出 WEAPON_POSES 片段 */
export function WeaponMountPanel({
    configs,
    onChange,
    charId,
    setStatus,
    initialSlot = 'main',
}: WeaponMountPanelProps) {
    const [weaponId, setWeaponId] = useState(WEAPON_IDS[0] ?? 'xiu_dong')
    const [pose, setPose] = useState('idle')
    /** 编辑哪个槽位：主手（表在 WEAPON_POSES[w][pose]）或副手（WEAPON_POSES[w].off[pose]） */
    const [slot, setSlot] = useState<WeaponSlot>(initialSlot)

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
    const overlay = WEAPON_OVERLAYS[weaponId]

    /**
     * 当前（武器 × 槽位 × 姿势）生效的配置：
     * 编辑器改过就用改过的，否则用引擎的解析结果（主手 = 登记值；副手 = 登记的 off 表或「副手默认」）。
     */
    const resolved = useMemo(() => resolveWeaponMount(weaponId, pose, { slot }), [weaponId, pose, slot])
    const rawRegistered = WEAPON_POSES[weaponId] ?? {}
    /** 该槽位是否在 weapons.ts 里有显式登记（副手没登记时用的是默认） */
    const registeredHere =
        slot === 'main'
            ? Boolean(poseConfigIn(rawRegistered, pose) ?? rawRegistered.idle)
            : Boolean(poseConfigIn(rawRegistered.off, pose) ?? rawRegistered.off?.idle)
    const registered = resolved.config
    const effective = configs[weaponId]?.[slot]?.[pose] ?? registered
    const dirty = Boolean(configs[weaponId]?.[slot]?.[pose])
    const handBase = useMemo(() => baseAnchorHand(effective, pose, slot), [effective, pose, slot])
    const targetBase = useMemo(() => baseTargetHand(pose), [pose])
    const showOffhandDefaultHint = slot === 'off' && resolved.usingOffhandDefault && !dirty
    const isDualWeapon = effective.grip2X !== undefined && effective.grip2Y !== undefined
    const anchorHandTip =
        slot === 'off'
            ? '副手槽的落点固定用全局副手手位（OTHER_HAND_POINT），这个选项对副手槽没有作用'
            : isDualWeapon
              ? '双手武器：杆身轴心锚哪只手（默认副手）。选「主手」= 绕主手转（打点/角度都会变）'
              : '单手武器默认锚主手；选「副手」= 把这把武器锚到副手位（等价于把它当副手武器）'

    const patch = useCallback(
        (fields: PoseCfg) => {
            onChange(weaponId, slot, pose, { ...effective, ...fields })
        },
        [effective, onChange, pose, slot, weaponId],
    )
    const clearField = useCallback(
        (key: keyof WeaponPoseConfig) => {
            const next: PoseCfg = { ...effective }
            delete next[key]
            onChange(weaponId, slot, pose, next)
        },
        [effective, onChange, pose, slot, weaponId],
    )

    /** 某槽位所有姿势的配置（导出用）：改过的用改过的，没改的用引擎解析值 */
    const tableFor = useCallback(
        (which: WeaponSlot) => {
            const out: Record<string, PoseCfg> = {}
            for (const p of POSES) {
                out[p] = configs[weaponId]?.[which]?.[p] ?? resolveWeaponMount(weaponId, p, { slot: which }).config
            }
            return out
        },
        [configs, weaponId],
    )
    const snippet = useMemo(() => {
        const offEdited = Object.keys(configs[weaponId]?.off ?? {}).length > 0
        const offRegistered = Object.keys(rawRegistered.off ?? {}).length > 0
        return formatWeaponPoseSnippet(weaponId, tableFor('main'), POSES, {
            offTable: offEdited || offRegistered ? tableFor('off') : undefined,
        })
    }, [configs, weaponId, tableFor, rawRegistered])

    // ── 交互：拖动移动 / Shift（右键）拖动旋转 ──
    const overlayRef = useRef<HTMLCanvasElement>(null)
    const dragRef = useRef<{
        mode: 'move' | 'rotate'
        startPointer: { x: number; y: number }
        startCfg: PoseCfg
        startAngle: number
    } | null>(null)
    const [hover, setHover] = useState(false)

    const anchorHand = useMemo(
        () => resolveWeaponMount(weaponId, pose, { slot, config: effective }).hand,
        [weaponId, pose, slot, effective],
    )
    const targetHand = useMemo(() => {
        const dual = effective.grip2X !== undefined && effective.grip2Y !== undefined
        if (!dual) return null
        return effective.targetX !== undefined && effective.targetY !== undefined
            ? { x: effective.targetX, y: effective.targetY }
            : (OTHER_HAND_POINT[pose] ?? OTHER_HAND_POINT.idle)
    }, [effective, pose])
    const angleDeg = useMemo(
        () =>
            Math.round(
                ((resolveWeaponMount(weaponId, pose, { slot, config: effective }).angle * 180) / Math.PI) * 10,
            ) / 10,
        [weaponId, pose, slot, effective],
    )

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
        setStatus(rotate ? '按住拖动：绕握点旋转（改角度）' : '拖动：移动武器（改手部锚点；双手武器会一起平移第二握点）')
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
            const next: PoseCfg = { ...base, ...dragHandOffset(base, pose, slot, startHand, dx, dy) }
            delete next.handX
            delete next.handY
            // 双手武器：目标手一起平移，保持角度不变
            if (base.grip2X !== undefined && base.grip2Y !== undefined) {
                const targetBase = baseTargetHand(pose)
                const startTarget =
                    base.targetX !== undefined && base.targetY !== undefined
                        ? { x: base.targetX, y: base.targetY }
                        : { x: targetBase.x + (base.targetDX ?? 0), y: targetBase.y + (base.targetDY ?? 0) }
                Object.assign(next, dragTargetOffset(pose, startTarget, dx, dy))
                delete next.targetX
                delete next.targetY
            }
            onChange(weaponId, slot, pose, next)
            return
        }
        // 旋转：从握点指向鼠标的角度差
        const anchor = resolveWeaponMount(weaponId, pose, { slot, config: drag.startCfg }).hand
        const a0 = Math.atan2(drag.startPointer.y - anchor.y, drag.startPointer.x - anchor.x)
        const a1 = Math.atan2(p.y - anchor.y, p.x - anchor.x)
        let next = drag.startAngle + (a1 - a0)
        // 收进 -180..180
        while (next > Math.PI) next -= Math.PI * 2
        while (next < -Math.PI) next += Math.PI * 2
        onChange(weaponId, slot, pose, { ...drag.startCfg, angle: Math.round(next * 10000) / 10000 })
    }

    const endDrag = () => {
        if (!dragRef.current) return
        dragRef.current = null
        setStatus('挂点已改动 —— 用「复制挂点片段」导出，整段替换 weapons.ts 里的 WEAPON_POSES 条目')
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
            if (targetHand) cross(targetHand.x, targetHand.y, '#ffd166', '二')
        },
        [anchorHand, targetHand, scale],
    )

    /** 登记值（weapons.ts 里那条配置）；用来做空字段的占位提示 */
    const registeredValue = (key: keyof WeaponPoseConfig): string => {
        if (key === 'handDX') return `基准 ${handBase.x}`
        if (key === 'handDY') return `基准 ${handBase.y}`
        if (key === 'targetDX') return `基准 ${targetBase.x}`
        if (key === 'targetDY') return `基准 ${targetBase.y}`
        const v = registered[key]
        if (v === undefined) return '自动'
        return `登记 ${typeof v === 'number' ? Math.round(v * 10000) / 10000 : String(v)}`
    }

    const numField = (label: string, key: keyof WeaponPoseConfig, step = 0.5, hint = '') => (
        <label
            className="pixel-editor-num-field"
            title={`${hint || label}（${String(key)}）：留空 = 用 weapons.ts 的登记值 / 引擎自动规则`}
        >
            <span>{label}</span>
            <input
                type="number"
                step={step}
                value={typeof effective[key] === 'number' ? (effective[key] as number) : ''}
                placeholder={registeredValue(key)}
                onChange={(e) => {
                    const raw = e.target.value
                    if (raw === '') clearField(key)
                    else patch({ [key]: Number(raw) } as PoseCfg)
                }}
            />
        </label>
    )

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
                </section>

                {/* 第二栏：挂点字段（自带握点 / 身上手位） */}
                <section className="pixel-editor-mount-col">
                    <h4 title="留空 = 用 weapons.ts 的登记值；真正的自动值看右栏「当前」一行">挂点</h4>
                    <div className="pixel-editor-mount-grid">
                        <label
                            className="pixel-editor-num-field"
                            title="武器倾角（度）。留空 = 自动（单手默认 0°/攻击 -45°；双手由两手连线算）"
                        >
                            <span>角度(度)</span>
                            <input
                                type="number"
                                step={1}
                                value={effective.angle !== undefined ? angleDeg : ''}
                                placeholder={
                                    registered.angle !== undefined
                                        ? `登记 ${Math.round(((registered.angle * 180) / Math.PI) * 10) / 10}`
                                        : '自动'
                                }
                                onChange={(e) => {
                                    const raw = e.target.value
                                    if (raw === '') clearField('angle')
                                    else patch({ angle: Math.round(((Number(raw) * Math.PI) / 180) * 10000) / 10000 })
                                }}
                            />
                        </label>
                        {numField('握点 X', 'gripX', 0.5, '武器图内的握柄坐标（美术坐标 32×32）；改这个 = 换握持位置')}
                        {numField('握点 Y', 'gripY')}
                        {numField('第二握点 X', 'grip2X', 0.5, '双手武器：第二个握柄（填了就按两手连线自动算角度）')}
                        {numField('第二握点 Y', 'grip2Y')}
                        {numField('挂点偏移 X', 'handDX', 0.5, '相对基准手位的偏移；拖动/输入的都是这个。基准见占位提示，最终落点看右栏「当前」一行')}
                        {numField('挂点偏移 Y', 'handDY')}
                        {numField('目标手偏移 X', 'targetDX', 0.5, '双手武器：相对目标手基准的偏移')}
                        {numField('目标手偏移 Y', 'targetDY')}
                    </div>
                </section>

                {/* 第三栏：开关 + 读数 + 操作 */}
                <section className="pixel-editor-mount-col">
                    <h4 title="翻转/不遮手/锚定手，以及导出与重置">开关 · 导出</h4>
                    <div className="pixel-editor-row">
                        <label className="pixel-editor-toggle" title="整体镜像（画朝左时用）">
                            <input
                                type="checkbox"
                                checked={Boolean(effective.flip)}
                                onChange={(e) => patch({ flip: e.target.checked || undefined })}
                            />
                            翻转
                        </label>
                        <label className="pixel-editor-toggle" title="不画手部遮罩（浮空类武器用）">
                            <input
                                type="checkbox"
                                checked={Boolean(effective.noHandCover)}
                                onChange={(e) => patch({ noHandCover: e.target.checked || undefined })}
                            />
                            不遮手
                        </label>
                        <label
                            className="pixel-editor-field pixel-editor-field--inline"
                            title={anchorHandTip}
                        >
                            <span>锚定手</span>
                            <select
                                value={effective.anchorHand ?? 'auto'}
                                disabled={slot === 'off'}
                                onChange={(e) =>
                                    e.target.value === 'auto'
                                        ? clearField('anchorHand')
                                        : patch({ anchorHand: e.target.value as 'main' | 'off' })
                                }
                            >
                                <option value="auto">自动</option>
                                <option value="main">主手</option>
                                <option value="off">副手</option>
                            </select>
                        </label>
                    </div>
                    <span
                        className="pixel-editor-colorline"
                        title={
                            showOffhandDefaultHint
                                ? '副手槽没登记：现在按「副手默认」画（全局副手手位 OTHER_HAND_POINT + 副手角度 DUAL_OFFHAND_ANGLE）。改任一字段（或拖动画布）就会写入这把武器的 off 表。'
                                : `${slot === 'off' ? '副手' : '主手'}槽的最终落点 = 基准 + 偏移；基准见各字段占位提示`
                        }
                    >
                        {slot === 'off' ? '副手' : '主手'} · 当前：角度 {angleDeg}° · 握点 (
                        {Math.round(anchorHand.x * 2) / 2}, {Math.round(anchorHand.y * 2) / 2})
                        {dirty ? ' · 已改动' : registeredHere ? ' · weapons.ts 登记值' : ' · 未登记（用默认）'}
                    </span>
                    <div className="pixel-editor-row">
                        <button
                            className="pixel-editor-btn"
                            title="复制这段整段替换 weapons.ts 的 WEAPON_POSES 条目"
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
                            title="只把当前这个姿势的改动清掉，回到 weapons.ts 的登记值"
                            disabled={!dirty}
                            onClick={() => {
                                onChange(weaponId, slot, pose, null)
                                setStatus(`${slot === 'off' ? '副手' : '主手'} ${pose} 已恢复为 weapons.ts 的登记值`)
                            }}
                        >
                            恢复本姿势
                        </button>
                        <button
                            className="pixel-editor-btn"
                            title="本武器两个槽位、所有姿势的改动都清掉，回到 weapons.ts 的登记值"
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
                    <b>绕握点旋转</b>（改角度）。青圈 = 握点，黄圈 = 第二握点（双手武器）。
                </p>
            </div>

        </div>
    )
}