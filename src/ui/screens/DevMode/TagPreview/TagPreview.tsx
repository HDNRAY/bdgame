/**
 * TagPreview —— 标签徽章配色的目视检查页（仅 DevMode 用，不进主流程）。
 *
 * 用途：`scripts/ui-geometry.mjs --pages tag-preview` 在亮/暗两套主题下各截一张图，
 * 人工确认 53 条标签徽章的分族、同族可分（heal 浅绿 / poison 深绿）与可读性。
 * 配色定义在 themes.css 的 `--tag-color-<tag>`，见 docs/ui-color-system.md 第 7 节。
 */
import { TAG_CN } from '../../../../bridge/tagDisplay'
import type { Tag } from '../../../../engine/entities/tag'
import './TagPreview.scss'

/** 按语义族分组（与 docs 第 7 节的 8 族一致），顺序固定便于两套主题对比 */
const GROUPS: { name: string; tags: Tag[] }[] = [
    { name: '伤害进攻', tags: ['slash', 'bleed', 'burn', 'low_hp', 'knockdown', 'knockback', 'bonus_damage', 'self_damage', 'electric'] },
    { name: '防御格挡', tags: ['parry', 'heavy_reduce', 'ignore_parry', 'defense', 'super_armor', 'counter'] },
    { name: '身法闪避', tags: ['move', 'sand_blind', 'frost'] },
    { name: '内息资源', tags: ['qi', 'qi_action', 'chan'] },
    { name: '增益恢复', tags: ['heal', 'buff', 'cleanse', 'pre_action'] },
    { name: '负面状态', tags: ['poison', 'paralyze', 'stun', 'debuff'] },
    { name: '武器流派', tags: ['unarmed', 'one_handed', 'weapon', 'thrown', 'blunt', 'melee', 'two_handed', 'pierce', 'polearm', 'heavy'] },
    {
        name: '机制规则',
        tags: ['inherent', 'internal', 'implant', 'jiu', 'talent', 'trigger', 'summon', 'stance', 'craft', 'imperial', 'retrieve_weapon', 'post_action', 'range', 'range_up'],
    },
]

export function TagPreviewScreen() {
    return (
        <div className="tag-preview">
            <div className="tag-preview-title">标签徽章配色（亮 / 暗各截一张）</div>
            <div className="tag-preview-note">
                重点看：heal 浅绿 / poison 深绿；electric（伤害族）；伤害族与武器族同带、靠彩度分开。
            </div>
            {GROUPS.map((g) => (
                <div className="tag-preview-group" key={g.name}>
                    <div className="tag-preview-group-name">{g.name}</div>
                    <div className="tag-preview-chips">
                        {g.tags.map((t) => (
                            <span className="tag-badge" key={t} style={{ color: `var(--tag-color-${t})`, borderColor: `var(--tag-color-${t})` }}>
                                {TAG_CN[t]}
                            </span>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}
