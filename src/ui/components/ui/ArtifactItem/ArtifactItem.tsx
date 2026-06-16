import type { Artifact } from '../../../../engine/entities/artifact'
import { Tooltip } from '../Tooltip/Tooltip'
import { ArtifactTooltip } from '../../tooltip-contents/ArtifactTooltip'
import '../EntityItem/EntityItem.scss'

interface ArtifactItemProps {
    artifact: Artifact
}

/** 奇物列表项 — 显示 "▸ 名称"，自带 ArtifactTooltip */
export function ArtifactItem({ artifact }: ArtifactItemProps) {
    return (
        <Tooltip content={<ArtifactTooltip artifact={artifact} />}>
            <div className="entity-item">
                <span className="entity-item-name">▸ {artifact.name}</span>
            </div>
        </Tooltip>
    )
}
