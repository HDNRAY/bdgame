import type { ActionConfig, RequiredCondition } from '../../../game/entities/action-config'
import {
    BUFF_OPTIONS,
    BUFF_TAG_OPTIONS,
    CONDITION_TYPES,
    canonicalConditionType,
    conditionParams,
    defaultParams,
    describeCondition,
    getConditionType,
    isKnownConditionId,
    resolveCondition,
} from '../../../data/conditions'

/** 条件摘要（未选状态 / 预设失效时给出可读文案，而不是空描述） */
function summarizeCondition(ac: ActionConfig): { text: string; warn: boolean } {
    if (!ac.condition && ac.conditionId && !isKnownConditionId(ac.conditionId)) {
        return { text: `条件已失效：${ac.conditionId}`, warn: true }
    }
    const cond = resolveCondition(ac)
    if (!cond) return { text: '不设条件', warn: false }
    if ('buffId' in cond && !cond.buffId) return { text: '未选择状态', warn: true }
    return { text: describeCondition(cond), warn: false }
}

/** 条件摘要按钮：点击展开下方的结构化编辑器 */
export function ConditionButton({
    ac,
    open,
    onToggle,
}: {
    ac: ActionConfig
    open: boolean
    onToggle: () => void
}) {
    const { text, warn } = summarizeCondition(ac)
    return (
        <button
            type="button"
            className={`cp-cond-btn${open ? ' open' : ''}${warn ? ' warn' : ''}`}
            onClick={onToggle}
            title="设置这招的使用条件"
        >
            {text}
        </button>
    )
}

/**
 * 出招必要条件编辑器（构筑模式）。
 * 「类型 + 参数」结构化编辑 —— 阈值由玩家自由设定，不再依赖写死的预设表。
 * 写入 ActionConfig.condition（结构化优先于旧的 conditionId）。
 */
export function ConditionEditor({ ac, onChange }: { ac: ActionConfig; onChange: (patch: Partial<ActionConfig>) => void }) {
    const cond: RequiredCondition | undefined = resolveCondition(ac)
    const type = cond ? canonicalConditionType(cond.type) : 'always'
    const typeDef = getConditionType(type)
    const params = typeDef ? (cond ? (conditionParams(cond) ?? defaultParams(typeDef)) : defaultParams(typeDef)) : {}

    if (!typeDef) return null

    const emit = (nextType: string, nextParams: Record<string, number | string>) => {
        const def = CONDITION_TYPES.find((t) => t.type === nextType)
        if (!def) return
        onChange({ condition: def.build(nextParams), conditionId: undefined })
    }

    /** 换类型：参数回到该类型的默认值 */
    const emitType = (nextType: string) => {
        const def = CONDITION_TYPES.find((t) => t.type === nextType)
        if (def) emit(nextType, defaultParams(def))
    }

    const setParam = (key: string, value: number | string) => emit(type, { ...params, [key]: value })

    return (
        <div className="cp-cond-editor">
            <div className="cp-cond-editor-row">
                <label className="cp-cond-field">
                    <span>条件</span>
                    <select value={type} onChange={(e) => emitType(e.target.value)}>
                        {CONDITION_TYPES.map((t) => (
                            <option key={t.type} value={t.type}>
                                {t.label}
                            </option>
                        ))}
                    </select>
                </label>
                {typeDef.params.map((p) => {
                    const raw = params[p.key]
                    if (p.kind === 'buff') {
                        return (
                            <label key={p.key} className="cp-cond-field">
                                <span>{p.label}</span>
                                <select value={String(raw ?? '')} onChange={(e) => setParam(p.key, e.target.value)}>
                                    <option value="">— 选择状态 —</option>
                                    {['状态', '异常'].map((group) => (
                                        <optgroup key={group} label={group}>
                                            {BUFF_OPTIONS.filter((b) => b.group === group).map((b) => (
                                                <option key={b.id} value={b.id}>
                                                    {b.name}
                                                </option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                            </label>
                        )
                    }
                    if (p.kind === 'buffTag') {
                        return (
                            <label key={p.key} className="cp-cond-field">
                                <span>{p.label}</span>
                                <select value={String(raw ?? '')} onChange={(e) => setParam(p.key, e.target.value)}>
                                    {BUFF_TAG_OPTIONS.map((t) => (
                                        <option key={t.id} value={t.id}>
                                            {t.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        )
                    }
                    return (
                        <label key={p.key} className="cp-cond-field">
                            <span>{p.label}</span>
                            <input
                                type="number"
                                value={Number(raw ?? 0)}
                                min={p.min}
                                max={p.max}
                                step={p.step}
                                onChange={(e) => setParam(p.key, Number(e.target.value))}
                            />
                            {p.unit && <em className="cp-cond-unit">{p.unit}</em>}
                        </label>
                    )
                })}
                <button type="button" className="cp-cond-clear" onClick={() => emit('always', {})} disabled={type === 'always'}>
                    清除
                </button>
            </div>
            <div className="cp-cond-hint">条件满足只代表这招「允许被选」，实际出招仍按伤害与内息效率择优。</div>
        </div>
    )
}
