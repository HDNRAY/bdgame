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
    { name: '持续伤害（大红 / 火红 / 深绿）', tags: ['bleed', 'burn', 'poison'] },
    { name: '伤害进攻（红 → 橙；残血已往红校准）', tags: ['bonus_damage', 'self_damage', 'low_hp'] },
    { name: '武器流派（低彩度冷色）', tags: ['slash', 'pierce', 'blunt', 'unarmed', 'melee', 'polearm', 'heavy', 'thrown', 'range', 'imperial', 'one_handed', 'two_handed', 'weapon'] },
    { name: '增益恢复（绿）', tags: ['heal', 'buff', 'cleanse'] },
    { name: '控制 / 感官（灰）', tags: ['stun', 'debuff', 'sand_blind', 'knockback', 'knockdown'] },
    { name: '麻痹（金黄）', tags: ['paralyze'] },
    { name: '霜冻（蓝白，低彩度）', tags: ['frost'] },
    { name: '内息资源（蓝 → 紫）', tags: ['qi', 'qi_action', 'chan'] },
    { name: '雷（亮蓝）', tags: ['electric'] },
    { name: '身法闪避（紫）', tags: ['move'] },
    { name: '防御格挡', tags: ['parry', 'heavy_reduce', 'ignore_parry', 'defense', 'super_armor', 'counter'] },
    { name: '酒（棕）', tags: ['jiu'] },
    {
        name: '机制规则（青灰）',
        tags: ['inherent', 'internal', 'implant', 'talent', 'trigger', 'summon', 'stance', 'craft', 'retrieve_weapon', 'post_action', 'range_up', 'pre_action'],
    },
]

export function TagPreviewScreen() {
    return (
        <div className="tag-preview">
            <div className="tag-preview-title">标签徽章配色（亮 / 暗各截一张）</div>
            <div className="tag-preview-note">
                重点看：持续伤害族里大红 / 火红 / 深绿三者能分开；霜冻蓝白、麻痹金黄、雷亮蓝、控制灰、酒棕；流派族低彩度。
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
