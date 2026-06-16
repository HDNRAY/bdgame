import type { EffectDef } from '../../../../engine/entities/action'
import { describeEffects } from '../../../../engine/data/effectDisplay'
import './EffectList.scss'

interface EffectListProps {
    effects: EffectDef[]
    /** 前置文案，默认 "效果：" */
    label?: string
}

/** 效果描述列表 — 将 EffectDef[] 渲染为中文描述列表 */
export function EffectList({ effects, label = '效果：' }: EffectListProps) {
    const lines = describeEffects(effects)
    if (lines.length === 0) return null
    return (
        <div className="effect-list">
            {label && <div className="el-label">{label}</div>}
            <ul>
                {lines.map((line, i) => (
                    <li key={i}>{line}</li>
                ))}
            </ul>
        </div>
    )
}
