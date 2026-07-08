import type { EffectDef } from '../../../../engine/entities/action'
import { describeEffect } from '../../../../engine/data/effectDisplay'
import { getBuff } from '../../../../engine/data/buffs'
import { EntityItem } from '../EntityItem/EntityItem'
import './EffectList.scss'

interface EffectListProps {
    effects: EffectDef[]
    /** 前置文案，默认 "效果：" */
    label?: string
}

/** 效果描述列表 — 将 EffectDef[] 渲染为中文描述列表 */
export function EffectList({ effects, label = '效果：' }: EffectListProps) {
    if (!effects || effects.length === 0) return null
    return (
        <div className="effect-list">
            {label && <div className="el-label">{label}</div>}
            <ul>
                {effects.map((eff, i) => (
                    <li key={i}>
                        {eff.type === 'add_buff' ? (
                            <AddBuffDisplay eff={eff} />
                        ) : (
                            describeEffect(eff).join('；')
                        )}
                    </li>
                ))}
            </ul>
        </div>
    )
}

function AddBuffDisplay({ eff }: { eff: Extract<EffectDef, { type: 'add_buff' }> }) {
    const buff = getBuff(eff.buffId)
    if (!buff) return <span>{eff.buffId}</span>
    return (
        <EntityItem entity={buff} type="buff">
            {eff.stacks ? `×${eff.stacks}` : undefined}
        </EntityItem>
    )
}
