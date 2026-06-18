import type { Artifact } from '../../../engine/entities/artifact'
import { describeEffects } from '../../../engine/data/effectDisplay'
import { TagList } from '../ui/TagList/TagList'
import { TriggerEffects } from '../ui/TriggerEffects/TriggerEffects'

interface ArtifactTooltipProps {
    artifact: Artifact
}

/** 奇物 tooltip 内容 */
export function ArtifactTooltip({ artifact }: ArtifactTooltipProps) {
    return (
        <div>
            <div className="tt-name">{artifact.name}</div>
            {artifact.tags.length > 0 && <TagList tags={artifact.tags} />}
            {artifact.description && <div className="tt-desc">{artifact.description}</div>}
            {artifact.effects && artifact.effects.length > 0 && (
                <div className="tt-extra" style={{ fontSize: 10, color: '#aaa', lineHeight: 1.6 }}>
                    {describeEffects(artifact.effects).join('；')}
                </div>
            )}
            {artifact.triggers && artifact.triggers.length > 0 && <TriggerEffects triggers={artifact.triggers} />}
        </div>
    )
}
