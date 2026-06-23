import type { Artifact } from '../../../engine/entities/artifact'
import type { EffectDef } from '../../../engine/entities/action'
import { describeEffect } from '../../../engine/data/effectDisplay'
import { TagList } from '../ui/TagList/TagList'
import { TriggerEffects } from '../ui/TriggerEffects/TriggerEffects'

interface ArtifactTooltipProps {
    artifact: Artifact
}

/** 奇物 tooltip 内容 */
export function ArtifactTooltip({ artifact }: ArtifactTooltipProps) {
    const sideEffects: EffectDef[] = []
    const mainEffects: EffectDef[] = []
    for (const eff of artifact.effects ?? []) {
        if (eff.type === 'add_debuff') sideEffects.push(eff)
        else mainEffects.push(eff)
    }

    return (
        <div>
            <div className="tt-name">{artifact.name}</div>
            {artifact.tags.length > 0 && <TagList tags={artifact.tags} />}
            {artifact.description && <div className="tt-desc">{artifact.description}</div>}
            {sideEffects.length > 0 && (
                <div className="tt-extra" style={{ fontSize: 10, color: '#e74c3c', lineHeight: 1.6 }}>
                    副作用: {sideEffects.flatMap(describeEffect).join('；')}
                </div>
            )}
            {mainEffects.length > 0 && (
                <div className="tt-extra" style={{ fontSize: 10, color: '#aaa', lineHeight: 1.6 }}>
                    {mainEffects.flatMap(describeEffect).join('；')}
                </div>
            )}
            {artifact.triggers && artifact.triggers.length > 0 && <TriggerEffects triggers={artifact.triggers} />}
        </div>
    )
}
