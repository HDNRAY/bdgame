import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { WEAPON_DB } from '../../../data/weapons/weapons'
import { STARTING_WEAPONS } from '../../../data/weapons/starting-weapons'
import { PASSIVES } from '../../../data/passives'
import { TALENTS } from '../../../data/passives/talents'
import { ARTIFACTS } from '../../../data/artifacts'
import { PLAYER_ACTIONS, SUPPORT_ACTIONS, QI_SKILLS } from '../../../data/actions'
import { TAG_CN } from '../../../bridge/tagDisplay'
import { EntityItem } from '../../components/ui/EntityItem/EntityItem'
import type { EntityDef } from '../../../bridge/entity-tooltip'
import type { EntityType } from '../../../bridge/entity-tooltip'
import './EncyclopediaScreen.scss'

type Category = 'weapon' | 'passive' | 'action' | 'artifact'

interface ItemEntry {
    entity: EntityDef
    type: EntityType
    name: string
    description: string
    tags: string[]
}

const ALL_WEAPONS = [...WEAPON_DB, ...STARTING_WEAPONS]
const ALL_PASSIVES = [...PASSIVES, ...TALENTS]
const ALL_ACTIONS = [...PLAYER_ACTIONS, ...SUPPORT_ACTIONS, ...QI_SKILLS]

const CATEGORIES: { key: Category; label: string }[] = [
    { key: 'weapon', label: '武器' },
    { key: 'passive', label: '功法' },
    { key: 'action', label: '招式' },
    { key: 'artifact', label: '奇物' },
]

function buildAllItems(): ItemEntry[] {
    const items: ItemEntry[] = []
    for (const w of ALL_WEAPONS) {
        items.push({
            entity: w as unknown as EntityDef,
            type: 'weapon',
            name: w.name,
            description: w.description ?? '',
            tags: w.tags as string[],
        })
    }
    for (const p of ALL_PASSIVES) {
        items.push({
            entity: p as unknown as EntityDef,
            type: 'passive',
            name: p.name,
            description: p.description ?? '',
            tags: p.tags as string[],
        })
    }
    for (const a of ALL_ACTIONS) {
        items.push({
            entity: a as unknown as EntityDef,
            type: 'action',
            name: a.name,
            description: a.description ?? '',
            tags: a.tags as string[],
        })
    }
    for (const a of ARTIFACTS) {
        items.push({
            entity: a as unknown as EntityDef,
            type: 'artifact',
            name: a.name,
            description: a.description ?? '',
            tags: a.tags as string[],
        })
    }
    return items
}

const ALL_ITEMS = buildAllItems()

export function EncyclopediaScreen() {
    const navigate = useNavigate()
    const [activeCategory, setActiveCategory] = useState<Category>('weapon')
    const [search, setSearch] = useState('')

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()
        return ALL_ITEMS.filter((item) => {
            if (item.type !== activeCategory) return false
            if (!q) return true
            if (item.name.toLowerCase().includes(q)) return true
            if (item.description.toLowerCase().includes(q)) return true
            for (const tag of item.tags) {
                const cn = (TAG_CN as Record<string, string>)[tag]?.toLowerCase() ?? ''
                if (cn.includes(q)) return true
            }
            return false
        })
    }, [activeCategory, search])

    return (
        <div className="encyclopedia">
            <div className="encyclopedia-header">
                <button className="encyclopedia-back" onClick={() => navigate('/')}>
                    ← 返回
                </button>
                <span className="encyclopedia-title">图鉴</span>
            </div>

            <div className="encyclopedia-search">
                <input
                    className="encyclopedia-search-input"
                    type="text"
                    placeholder="搜索名字、描述、标签…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoFocus
                />
            </div>

            <div className="encyclopedia-tabs">
                {CATEGORIES.map((cat) => (
                    <button
                        key={cat.key}
                        className={`encyclopedia-tab ${activeCategory === cat.key ? 'active' : ''}`}
                        onClick={() => {
                            setActiveCategory(cat.key)
                            setSearch('')
                        }}
                    >
                        {cat.label}
                        <span className="encyclopedia-tab-count">
                            {ALL_ITEMS.filter((i) => i.type === cat.key).length}
                        </span>
                    </button>
                ))}
            </div>

            <div className="encyclopedia-list">
                {filtered.length === 0 ? (
                    <div className="encyclopedia-empty">未找到匹配项</div>
                ) : (
                    filtered.map((item, i) => (
                        <div key={`${item.type}-${i}`} className="encyclopedia-item">
                            <EntityItem entity={item.entity} type={item.type} />
                            <div className="encyclopedia-item-desc">{item.description}</div>
                            {item.tags.length > 0 && (
                                <div className="encyclopedia-item-tags">
                                    {item.tags.map((tag) => {
                                        const cn = (TAG_CN as Record<string, string>)[tag]
                                        return cn ? (
                                            <span key={tag} className="encyclopedia-tag">
                                                {cn}
                                            </span>
                                        ) : null
                                    })}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
