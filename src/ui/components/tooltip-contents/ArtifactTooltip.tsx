import type { Artifact } from '../../../engine/entities/artifact'
import { getAction } from '../../../engine/data/actions'
import { getTriggerName } from '../../../engine/data/triggers'
import { describeEffects } from '../../../engine/data/effectDisplay'
import { TagList } from '../ui/TagList/TagList'

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
            {artifact.triggers && artifact.triggers.length > 0 && (
                <>
                    <hr className="tt-separator" />
                    {artifact.triggers.map((t, i) => {
                        const name = getTriggerName(t.condition.type)
                        const actionName = t.actionId ? getAction(t.actionId)?.name : undefined
                        return (
                            <div key={i} className="tt-extra" style={{ fontSize: 10, lineHeight: 1.7 }}>
                                <span style={{ color: '#888' }}>触发</span> {name}
                                {actionName && <span style={{ color: '#aaa' }}> → {actionName}</span>}
                                {!actionName && t.effects && t.effects.length > 0 && (
                                    <span style={{ color: '#aaa' }}> → {describeEffects(t.effects).join('；')}</span>
                                )}
                            </div>
                        )
                    })}
                </>
            )}
        </div>
    )
}
