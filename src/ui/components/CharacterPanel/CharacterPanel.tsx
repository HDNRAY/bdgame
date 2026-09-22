import { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PixelCanvas } from '../ui/PixelCanvas/PixelCanvas'
import { useNavigate } from 'react-router-dom'
import type { CharacterBuild } from '../../../game/entities/character-build'
import type { Character } from '../../../engine/entities/character'
import { getAction } from '../../../data/actions'
import { getWeapon, type WeaponDef } from '../../../data/weapons/weapons'
import { getPassive } from '../../../data/passives'
import { canBeTriggerAction, type ActionConfig } from '../../../game/entities/action-config'
import { describeCondition, resolveCondition } from '../../../data/conditions'
import { SELECTABLE_TRIGGER_CONDITIONS } from '../../../data/triggers'
import { getTriggerConditionName } from '../../../bridge/triggerDisplay'
import type { AttrName } from '../../../engine/entities/attributes'
import type { Reward } from '../../../game/entities/reward'
import { ARTIFACTS } from '../../../data/artifacts'
import { RewardPicker, type PickKind } from './RewardPicker'
import { ConditionButton, ConditionEditor } from './ConditionEditor'
import { rowIndexAtY } from './rowDrag'
import { SearchSelect } from '../ui/SearchSelect/SearchSelect'
import { getCharacterAvatar, getSpriteOutlineColor, getWeaponOverlay } from '../../../ui/pixel-sprites'
import { useBuildCharacter, cultCost } from '../../hooks/useBuildCharacter'
import { useAppStore, getEffectiveTheme } from '../../stores/app-store'
import { BattleStyleSelector } from './BattleStyleSelector'
import { EntityItem } from '../ui/EntityItem/EntityItem'
import { AttributeLabel } from '../ui/AttributeLabel/AttributeLabel'
import './CharacterPanel.scss'

/** 计算某属性的来源分解（读来源层账的实际生效量，与战斗面板同源） */
function getAttrBreakdown(
    attr: AttrName,
    character: Character,
): { base: number; passives: number; artifacts: number; weapons: number } {
    const base = character.build.baseAttrs?.[attr] ?? 3
    let passives = 0,
        artifacts = 0,
        weapons = 0
    for (const layer of character.sourceLayers) {
        const delta = layer.applied[attr] ?? 0
        if (delta === 0) continue
        if (layer.kind === 'artifact') artifacts += delta
        else if (layer.kind === 'weapon' || layer.kind === 'offhand') weapons += delta
        else passives += delta
    }
    return { base, passives, artifacts, weapons }
}

interface CharacterPanelProps {
    mode: 'view' | 'build'
    build: CharacterBuild
    accentColor?: string
    onSave?: (build: CharacterBuild, remaining?: number) => void
    onBack?: () => void
    unspentCultPoints?: number

    /** 构筑模式（DevMode · 构筑试炼）：开放奖励槽自选 / 武器槽 */
    poolMode?: boolean
    /** 奖励位上限（不含初始武器） */
    poolCap?: number
    /** 已占用槽数（rewards 数 + 选件武器数） */
    poolUsed?: number
    /** 奖励里选出的武器槽（第 1 把=主手覆盖初始，第 2 把=副手）；初始默认主手不在此列 */
    poolWeaponSlots?: { slot: 'main' | 'off'; id: string }[]
    onAddReward?: (kind: PickKind, id: string) => void
    onRemoveReward?: (kind: Exclude<Reward['type'], 'weapon'>, id: string) => void
    onRemoveWeaponSlot?: (slot: 'main' | 'off') => void
    /** 挑选器武器页过滤（如：当前只能选单手武器作副手） */
    poolWeaponFilter?: (weapon: WeaponDef) => boolean
}

const ATTR_ORDER: AttrName[] = ['strength', 'vitality', 'agility', 'dexterity', 'insight', 'wisdom']

export function CharacterPanel({
    mode,
    build,
    accentColor = '#888',
    onSave,
    onBack,
    unspentCultPoints,
    poolMode = false,
    poolCap = 13,
    poolUsed = 0,
    poolWeaponSlots = [],
    onAddReward,
    onRemoveReward,
    onRemoveWeaponSlot,
    poolWeaponFilter,
}: CharacterPanelProps) {
    const navigate = useNavigate()
    const isBuild = mode === 'build'
    const [pickerOpen, setPickerOpen] = useState(false)
    /** 招式表容器：拖拽排序算落点用（行本身量不到 rect） */
    const tableRef = useRef<HTMLDivElement>(null)

    // 头像描边随主题（dark = 浅灰）
    const themeMode = useAppStore((s) => s.uiConfig.theme)
    const outlineColor = getSpriteOutlineColor(getEffectiveTheme(themeMode))

    // Build 模式状态管理
    const {
        actionConfigs,
        battleStyle,
        setBattleStyle,
        character,
        remaining,
        maxTriggerSlots,
        triggerCount,
        activeTalents,
        saveError,
        handleAttrAdjust,
        handleReset,
        moveAction,
        updateAction,
        handleSave,
    } = useBuildCharacter(build, onSave, unspentCultPoints)

    const spriteId = character?.build.spriteId ?? 'default'
    const weapon = character?.weaponDef ?? (character ? getWeapon(character.build.weapon) : undefined)

    // 已选触发 ID 集合（只检查 actionConfigs，不检查武器/功法/奇物自带触发）
    const takenTriggerIds = new Set(actionConfigs.map((ac) => ac.triggerId).filter((id): id is string => !!id))

    // 拖拽排序：指针按住手柄上下拖。
    // 行是 display:contents（量不到 rect），所以按「招式名单元格」的底边算落点，见 rowDrag.ts。
    const [dragging, setDragging] = useState<{ from: number; over: number; x: number; y: number } | null>(null)

    function rowBottoms(): number[] {
        const cells = tableRef.current?.querySelectorAll('.cp-row > .cp-col-name') ?? []
        return [...cells].map((el) => el.getBoundingClientRect().bottom)
    }

    function startDrag(index: number) {
        return (e: React.PointerEvent) => {
            e.preventDefault()
            setDragging({ from: index, over: index, x: e.clientX, y: e.clientY })
            const onMove = (ev: PointerEvent) => {
                const to = rowIndexAtY(rowBottoms(), ev.clientY)
                setDragging((d) => (d && to >= 0 ? { ...d, over: to, x: ev.clientX, y: ev.clientY } : d))
            }
            const onUp = (ev: PointerEvent) => {
                window.removeEventListener('pointermove', onMove)
                window.removeEventListener('pointerup', onUp)
                window.removeEventListener('pointercancel', onUp)
                const to = rowIndexAtY(rowBottoms(), ev.clientY)
                setDragging(null)
                if (to >= 0 && to !== index) moveAction(index, to)
            }
            window.addEventListener('pointermove', onMove)
            window.addEventListener('pointerup', onUp)
            window.addEventListener('pointercancel', onUp)
        }
    }

    // 构筑模式：已选奖励集合（供挑选器去重）与奖励定义查找
    const rewardExclude = useMemo(() => {
        const map: Partial<Record<Reward['type'], Set<string>>> = {
            action: new Set(),
            passive: new Set(),
            artifact: new Set(),
            weapon: new Set(),
        }
        for (const r of build.rewards) map[r.type]?.add(r.id)
        for (const s of poolWeaponSlots) map.weapon?.add(s.id)
        return map
    }, [build.rewards, poolWeaponSlots])

    const rewardDef = (kind: Reward['type'], id: string) => {
        if (kind === 'action') return getAction(id)
        if (kind === 'passive') return getPassive(id)
        if (kind === 'artifact') return ARTIFACTS.find((a) => a.id === id)
        return getWeapon(id)
    }

    if (!character) return null

    // 天赋在构筑模式下用 chip 单独展示（activeTalents），功法列表里不重复列
    const shownPassives = isBuild ? character.passiveDefs.filter((p) => !p.tags.includes('talent')) : character.passiveDefs

    return (
        <div className="character-panel">
            {/* Header */}
            {isBuild && (
                <div className="cp-header">
                    <button className="cp-btn" onClick={onBack ?? (() => navigate('/select'))}>
                        返回
                    </button>
                    <div className="cp-actions">
                        <button className="cp-btn cp-btn-reset" onClick={handleReset}>
                            复位
                        </button>
                        <button className="cp-btn cp-btn-save" onClick={handleSave}>
                            保存
                        </button>
                    </div>
                </div>
            )}

            {isBuild && saveError && <div className="cp-error">{saveError}</div>}

            {/* 拖拽时跟随指针的「块块」：行是 display:contents 移不动，所以单画一个浮层（portal 到 body，避免被裁切） */}
            {dragging &&
                createPortal(
                    <div className="cp-drag-ghost" style={{ left: dragging.x, top: dragging.y }}>
                        <span className="cp-drag-ghost-name">
                            {getAction(actionConfigs[dragging.from]?.actionId)?.name ?? '招式'}
                        </span>
                        <span className="cp-drag-ghost-pos">第 {dragging.over + 1} 位</span>
                    </div>,
                    document.body,
                )}

            <div className="cp-body">
                {/* 左栏：区块1+4 */}
                <div
                    className="cp-col-left"
                    style={{ position: isBuild ? 'sticky' : 'static', top: isBuild ? 0 : undefined }}
                >
                    {/* 区块1: 角色信息 */}
                    <div className="cp-section cp-info-section">
                        <div className="cp-info-left">
                            <div className="cp-info-row">
                                <PixelCanvas
                                    pixels={getCharacterAvatar(spriteId, accentColor, outlineColor).pixels}
                                    palette={getCharacterAvatar(spriteId, accentColor, outlineColor).palette}
                                    scale={4}
                                    className="cp-avatar"
                                />
                                <div className="cp-info-name">{character.name}</div>
                            </div>
                            <div className="cp-info-row">
                                <div className="cp-hp-ap">
                                    <span className="cp-hp">气血</span> {character.maxHp}
                                    <span className="cp-sep">·</span>
                                    <span className="cp-ap">内息</span> {character.maxAp}
                                </div>
                            </div>
                            <div className="cp-info-row">
                                {/* 武器本体那张（通用图 overlay），与武器名并排展示；战斗里按姿势的形态不在这里 */}
                                <PixelCanvas
                                    overlay={getWeaponOverlay(character.build.weapon)}
                                    className="cp-weapon-art"
                                />
                                {weapon && <EntityItem entity={weapon} type="weapon" />}
                            </div>
                        </div>
                        <div className="cp-info-right">
                            <div className="cp-style-label">战斗风格</div>
                            <BattleStyleSelector
                                value={battleStyle}
                                onChange={setBattleStyle}
                                weapon={weapon}
                                isBuild={isBuild}
                            />
                        </div>
                    </div>

                    {/* 区块4: 招式 */}
                    <div className="cp-section">
                        <div className="cp-section-label">
                            招式 ({character.actions.length})
                            {isBuild && (
                                <span className="cp-trigger-count">
                                    {triggerCount}/{maxTriggerSlots} 触发
                                </span>
                            )}
                        </div>
                        {isBuild ? (
                            <>
                                {/* 表头与所有招式行共用一个网格（行内 display:contents），各列宽度才统一。
                                    DndContext/SortableContext 不产生 DOM，不会破坏这个网格。 */}
                                <div className="cp-table" ref={tableRef}>
                                    <div className="cp-table-header">
                                        <span className="cp-col-handle" aria-hidden="true" />
                                        <span className="cp-col-name">招式</span>
                                        <span className="cp-col-cond">条件</span>
                                        <span className="cp-col-trig">触发</span>
                                    </div>
                                    {actionConfigs.map((ac, i) => (
                                        <ActionRow
                                            key={ac.actionId}
                                            ac={ac}
                                            index={i}
                                            onUpdate={updateAction}
                                            onDragStart={startDrag}
                                            dragging={dragging}
                                            disabled={triggerCount >= maxTriggerSlots && !ac.triggerId}
                                            takenTriggerIds={takenTriggerIds}
                                        />
                                    ))}
                                </div>
                                <div className="cp-table-note">
                                    列表顺序就是出招顺序：靠前的招只要当场能用（够得着、内息与缠劲够、条件满足）就先出它。
                                    顺序管出哪一招，站多远仍由战斗风格与效率决定。触发招式不耗内息、只耗缠劲，
                                    但位移类招式与内息消耗 3 点及以上的招式不能设成触发招式。
                                </div>
                            </>
                        ) : (
                            <div className="cp-tag-list">
                                {character.actions
                                    .filter((a) => !a.def.tags.includes('internal'))
                                    .map((act, i) => {
                                        const cfg = character.getConfig(act.id)
                                        const cond = resolveCondition(cfg)
                                        const condName = cond ? describeCondition(cond) : null
                                        const trigName = cfg?.triggerId ? getTriggerConditionName(cfg.triggerId) : null
                                        return (
                                            <EntityItem key={i} entity={act.def} type="action">
                                                {(condName || trigName) && (
                                                    <>
                                                        {condName && <span className="cp-tag-cond">{condName}</span>}
                                                        {trigName && <span className="cp-tag-trig">{trigName}</span>}
                                                    </>
                                                )}
                                            </EntityItem>
                                        )
                                    })}
                            </div>
                        )}
                    </div>
                </div>

                {/* 右栏：区块2+3 */}
                <div className="cp-col-right">
                    {/* 区块2: 属性 */}
                    <div className="cp-section">
                        <div className="cp-section-label">属性</div>
                        {isBuild && <div className="cp-points">修炼点: 剩余 {remaining}</div>}
                        {ATTR_ORDER.map((attr) => {
                            const finalVal = Math.round(character.attrs.get(attr))
                            const brk = getAttrBreakdown(attr, character)
                            return (
                                <div key={attr} className="cp-attr-row">
                                    <AttributeLabel attr={attr} value={finalVal} baseValue={brk.base} breakdown={brk} />
                                    {isBuild && (
                                        <>
                                            <button
                                                className="cp-btn-sm"
                                                disabled={brk.base <= (build.baseAttrs?.[attr] ?? 3)}
                                                onClick={() => handleAttrAdjust(attr, -1)}
                                            >
                                                −
                                            </button>
                                            <button
                                                className="cp-btn-sm"
                                                disabled={brk.base >= 30 || remaining < cultCost(brk.base)}
                                                onClick={() => handleAttrAdjust(attr, 1)}
                                            >
                                                +
                                            </button>
                                            {brk.base < 30 && <span className="cp-cost">{cultCost(brk.base)}pt</span>}
                                        </>
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    {/* 区块2.5（构筑模式）: 奖励槽 */}
                    {isBuild && poolMode && (
                        <div className="cp-section">
                            <div className="cp-section-label">
                                奖励 ({poolUsed}/{poolCap})
                                <button className="cp-btn-sm cp-add-btn" onClick={() => setPickerOpen(true)}>
                                    + 添加
                                </button>
                            </div>
                            <div className="cp-pool-list">
                                {poolWeaponSlots.map((s) => (
                                    <div key={s.slot} className="cp-pool-row">
                                        <span className="cp-pool-slot">{s.slot === 'main' ? '主手' : '副手'}</span>
                                        <EntityItem entity={rewardDef('weapon', s.id) as never} type="weapon" />
                                        <button
                                            className="cp-btn-sm"
                                            title={s.slot === 'main' ? '移除该武器，恢复初始武器' : '移除副手武器'}
                                            onClick={() => onRemoveWeaponSlot?.(s.slot)}
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                                {build.rewards.map((r) => {
                                    if (r.type === 'weapon') return null
                                    const def = rewardDef(r.type, r.id)
                                    if (!def) return null
                                    return (
                                        <div key={`${r.type}-${r.id}`} className="cp-pool-row">
                                            <EntityItem
                                                entity={def as never}
                                                type={r.type as 'action' | 'passive' | 'artifact'}
                                            />
                                            <button
                                                className="cp-btn-sm"
                                                onClick={() =>
                                                    onRemoveReward?.(r.type as Exclude<Reward['type'], 'weapon'>, r.id)
                                                }
                                            >
                                                ×
                                            </button>
                                        </div>
                                    )
                                })}
                                {poolUsed === 0 && (
                                    <div className="cp-pool-empty">
                                        从招式 / 功法 / 奇物中挑选奖励；武器可在「武器」页选（第 1 把为主手、第 2 把为副手），
                                        至多 {poolCap} 个奖励位
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {pickerOpen && (
                        <RewardPicker
                            exclude={rewardExclude}
                            weaponFilter={poolWeaponFilter}
                            used={poolUsed}
                            cap={poolCap}
                            onToggle={(kind, id) => {
                                // 弹窗不关闭：点已选 = 取消，点未选 = 加入（满位时弹窗内提示）
                                if (kind === 'weapon') {
                                    const slot = poolWeaponSlots.find((s) => s.id === id)
                                    if (slot) onRemoveWeaponSlot?.(slot.slot)
                                    else onAddReward?.(kind, id)
                                    return
                                }
                                if (rewardExclude[kind]?.has(id)) onRemoveReward?.(kind, id)
                                else onAddReward?.(kind, id)
                            }}
                            onClose={() => setPickerOpen(false)}
                        />
                    )}

                    {/* 区块3: 天赋 + 功法 + 奇物 */}
                    {isBuild && activeTalents.length > 0 && (
                        <div className="cp-section">
                            <div className="cp-section-label">天赋</div>
                            <div className="cp-tag-list">
                                {activeTalents.map((t) => {
                                    const def = getPassive(t.id)
                                    return (
                                        <span key={t.id} className="cp-talent">
                                            {def?.name ?? t.id}
                                        </span>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {!poolMode && shownPassives.length > 0 && (
                        <div className="cp-section">
                            <div className="cp-section-label">功法 ({shownPassives.length})</div>
                            <div className="cp-tag-list">
                                {shownPassives.map((p, i) => (
                                    <EntityItem key={i} entity={p} type="passive" />
                                ))}
                            </div>
                        </div>
                    )}

                    {!poolMode && character.artifactDefs.length > 0 && (
                        <div className="cp-section">
                            <div className="cp-section-label">奇物 ({character.artifactDefs.length})</div>
                            <div className="cp-tag-list">
                                {character.artifactDefs.map((art, i) => (
                                    <EntityItem key={i} entity={art} type="artifact" />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

/** 招式行：拖拽手柄（顺序 = 出招优先级）+ 条件（展开占整行）+ 触发槽绑定 */
function ActionRow({
    ac,
    index,
    onUpdate,
    onDragStart,
    dragging,
    disabled,
    takenTriggerIds,
}: {
    ac: ActionConfig
    index: number
    onUpdate: (i: number, patch: Partial<ActionConfig>) => void
    onDragStart: (index: number) => (e: React.PointerEvent) => void
    dragging: { from: number; over: number } | null
    disabled: boolean
    takenTriggerIds: Set<string>
}) {
    const [condOpen, setCondOpen] = useState(false)
    const isSource = dragging?.from === index
    const isTarget = dragging !== null && dragging.over === index && !isSource
    const actionDef = getAction(ac.actionId)
    // 位移招式与内息消耗 > 2 的招式不能作为触发招式（与引擎护栏一致）
    const triggerBlocked = !!actionDef && !canBeTriggerAction(actionDef)
    const blockedReason = !actionDef
        ? undefined
        : actionDef.tags.includes('move')
          ? '位移类招式不能设成触发招式'
          : `这招要花 ${actionDef.apCost} 点内息，3 点及以上的招式不能设成触发招式`

    return (
        <>
            <div className={`cp-row${isTarget ? ' over' : ''}${isSource ? ' dragging' : ''}`}>
                <span className="cp-col-handle">
                    <button
                        type="button"
                        className="cp-drag"
                        title="按住上下拖动，调整出招顺序（靠前的先出）"
                        aria-label="拖动调整出招顺序"
                        onPointerDown={onDragStart(index)}
                    />
                </span>
                <span className="cp-col-name">
                    {actionDef ? <EntityItem entity={actionDef} type="action" /> : ac.actionId}
                </span>
                <span className="cp-col-cond">
                    <ConditionButton ac={ac} open={condOpen} onToggle={() => setCondOpen((o) => !o)} />
                </span>
                <span className="cp-col-trig">
                    {triggerBlocked ? (
                        /* 不能设成触发的招式：说明写在表下与 title 里，格子里只标「不可触发」 */
                        <span className="cp-trig-none" title={blockedReason}>
                            不可触发
                        </span>
                    ) : (
                        <SearchSelect
                            value={ac.triggerId ?? ''}
                            options={[
                                { value: '', label: '—' },
                                ...SELECTABLE_TRIGGER_CONDITIONS.filter(
                                    (tc) => !takenTriggerIds.has(tc.id) || tc.id === ac.triggerId,
                                ).map((tc) => ({ value: tc.id, label: getTriggerConditionName(tc.id) })),
                            ]}
                            onChange={(v) => onUpdate(index, { triggerId: v || undefined })}
                            disabled={disabled}
                            title={disabled ? '触发槽已满，先腾出一个再设置' : undefined}
                            searchPlaceholder="搜索触发条件…"
                        />
                    )}
                </span>
            </div>
            {condOpen && <ConditionEditor ac={ac} onChange={(patch) => onUpdate(index, patch)} />}
        </>
    )
}
