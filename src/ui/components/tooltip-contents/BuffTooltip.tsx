import type { BuffDef } from '../../../engine/data/buffs/types'
import { TagList } from '../ui/TagList/TagList'

interface BuffTooltipProps {
    buff: BuffDef
}

export function BuffTooltip({ buff }: BuffTooltipProps) {
    const attrModLines: string[] = []
    if (buff.attrMods) {
        for (const [k, v] of Object.entries(buff.attrMods)) {
            attrModLines.push(`${k} ${v > 0 ? '+' : ''}${v}`)
        }
    }

    return (
        <div>
            <div className="tt-name">{buff.name}</div>
            {buff.tags.length > 0 && <TagList tags={buff.tags} />}
            {buff.description && <div className="tt-desc">{buff.description}</div>}
            {buff.expiry && (
                <div className="tt-extra" style={{ fontSize: 10, color: '#888', lineHeight: 1.6 }}>
                    {buff.expiry.type === 'duration' && `持续 ${buff.expiry.ms / 1000}秒`}
                    {buff.expiry.type === 'permanent' && '永久'}
                    {buff.expiry.type === 'consumed' && `消耗: ${buff.expiry.trigger}`}
                    {buff.stacking?.type === 'additive' && ` · 最多 ${buff.stacking.max ?? '∞'}层`}
                    {buff.stacking?.type === 'none' && ' · 不可叠层'}
                    {buff.stacking?.type === 'independent' && ' · 独立叠层'}
                </div>
            )}
            {attrModLines.length > 0 && (
                <div className="tt-extra" style={{ fontSize: 10, color: '#aaa', lineHeight: 1.6 }}>
                    {attrModLines.join('；')}
                </div>
            )}
        </div>
    )
}
