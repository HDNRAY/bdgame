import type { Artifact } from '../../../engine/entities/artifact'
import type { EffectDef } from '../../../engine/entities/action'
import { constructEffectsOf } from '../../../engine/entities/trigger'
import { describeEffect } from '../../../data/effectDisplay'
import { getAction } from '../../../data/actions'
import { TagList } from '../ui/TagList/TagList'
import { TriggerEffects } from '../ui/TriggerEffects/TriggerEffects'
import { EntityItem } from '../ui/EntityItem/EntityItem'

interface ArtifactTooltipProps {
    artifact: Artifact
}

/** 奇物 tooltip 内容 */
export function ArtifactTooltip({ artifact }: ArtifactTooltipProps) {
    // 「自带效果」= 源的构造期槽（on_construct）的 apply；运行时触发由 TriggerEffects 展示
    const sideEffects: EffectDef[] = []
    const mainEffects: EffectDef[] = []
    for (const eff of constructEffectsOf(artifact)) {
        if (eff.type === 'add_debuff') sideEffects.push(eff)
        else mainEffects.push(eff)
    }

    return (
        <div>
            <div className="tt-name">{artifact.name}</div>
            {artifact.tags.length > 0 && <TagList tags={artifact.tags} />}
            {artifact.description && <div className="tt-desc">{artifact.description}</div>}
            {sideEffects.length > 0 && (
                <div className="tt-extra tt-extra-danger">副作用: {sideEffects.flatMap(describeEffect).join('；')}</div>
            )}
            {mainEffects.length > 0 && (
                <div className="tt-extra tt-extra-dim">{mainEffects.flatMap(describeEffect).join('；')}</div>
            )}
            {artifact.grantsActions && artifact.grantsActions.length > 0 && (
                <div className="tt-extra" style={{ marginTop: 'var(--sp-xxs)' }}>
                    <div className="tt-label">赋予招式:</div>
                    <div className="tt-flex-wrap">
                        {artifact.grantsActions.map((id) => {
                            const def = getAction(id)
                            return def ? <EntityItem key={id} entity={def} type="action" /> : null
                        })}
                    </div>
                </div>
            )}
            {artifact.effects && artifact.effects.length > 0 && <TriggerEffects triggers={artifact.effects} />}
        </div>
    )
}
