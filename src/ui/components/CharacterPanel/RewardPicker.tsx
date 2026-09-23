import { useState } from 'react'
import { allMainActions } from '../../../data/actions'
import { PASSIVES } from '../../../data/passives'
import { ARTIFACTS } from '../../../data/artifacts'
import { WEAPON_DB, type WeaponDef } from '../../../data/weapons/weapons'
import { TAG_CN } from '../../../bridge/tagDisplay'
import { getWeaponOverlay } from '../../pixel-sprites'
import type { Reward } from '../../../game/entities/reward'
import { EntityItem } from '../ui/EntityItem/EntityItem'
import { PixelCanvas } from '../ui/PixelCanvas/PixelCanvas'
import './RewardPicker.scss'

export type PickKind = Reward['type'] // 'weapon' | 'action' | 'passive' | 'artifact'

interface RewardPickerProps {
    /** 已选集合（按类别）— 用于在列表里标出「已选」，不再从列表里隐藏 */
    exclude: Partial<Record<PickKind, Set<string>>>
    /** 点选 / 取消点选（当前是否已选由 exclude 决定） */
    onToggle: (kind: PickKind, id: string) => void
    onClose: () => void
    /** 武器页额外过滤（如：当前选择将作为副手时只列单手武器） */
    weaponFilter?: (weapon: WeaponDef) => boolean
    /** 奖励位占用 / 上限（用于显示与满位提示） */
    used: number
    cap: number
}

const TABS: { kind: PickKind; label: string }[] = [
    { kind: 'action', label: '招式' },
    { kind: 'passive', label: '功法' },
    { kind: 'artifact', label: '奇物' },
    { kind: 'weapon', label: '武器' },
]

/** 与游戏奖励池口径一致：inherent（血脉限定/特性）与 imperial（御物）不可自选 */
const isPoolPassive = (p: { tags?: string[] }) => !p.tags?.includes('inherent')
const isPoolArtifact = (a: { tags?: string[] }) => !a.tags?.includes('inherent')
const isPoolWeapon = (w: { tags?: string[] }) => !w.tags?.includes('imperial')

/** 窄屏（手机）判断：用于关掉自动聚焦，避免一打开就弹键盘 */
const isNarrowScreen = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches

export function RewardPicker({ exclude, onToggle, onClose, weaponFilter, used, cap }: RewardPickerProps) {
    const [kind, setKind] = useState<PickKind>('action')
    const [query, setQuery] = useState('')
    const [notice, setNotice] = useState('')
    const excluded = exclude[kind] ?? new Set<string>()

    const items: { id: string; entity: unknown; type: 'action' | 'passive' | 'artifact' | 'weapon' }[] = (() => {
        if (kind === 'action') {
            return allMainActions
                .filter((a) => !a.tags.includes('internal'))
                .map((a) => ({ id: a.id, entity: a, type: 'action' as const }))
        }
        if (kind === 'passive') {
            return PASSIVES.filter((p) => isPoolPassive(p)).map((p) => ({
                id: p.id,
                entity: p,
                type: 'passive' as const,
            }))
        }
        if (kind === 'artifact') {
            return ARTIFACTS.filter((a) => isPoolArtifact(a)).map((a) => ({
                id: a.id,
                entity: a,
                type: 'artifact' as const,
            }))
        }
        return WEAPON_DB.filter((w) => isPoolWeapon(w) && (weaponFilter ? weaponFilter(w) : true)).map((w) => ({
            id: w.id,
            entity: w,
            type: 'weapon' as const,
        }))
    })()
    /** 搜索：名字 / 描述 / 标签（标签同时匹配英文 id 与中文名） */
    const keyword = query.trim().toLowerCase()
    const filtered = keyword
        ? items.filter((it) => {
              const e = it.entity as { name?: string; description?: string; tags?: string[] }
              if ((e.name ?? '').toLowerCase().includes(keyword)) return true
              if ((e.description ?? '').toLowerCase().includes(keyword)) return true
              return (e.tags ?? []).some(
                  (tag) =>
                      tag.toLowerCase().includes(keyword) ||
                      ((TAG_CN as Record<string, string>)[tag] ?? '').toLowerCase().includes(keyword),
              )
          })
        : items

    const full = used >= cap
    const selectedCount = TABS.reduce((n, t) => n + (exclude[t.kind]?.size ?? 0), 0)

    const handleClick = (kindOfItem: PickKind, id: string, selected: boolean) => {
        if (!selected && used >= cap) {
            setNotice(`奖励位已满（${used}/${cap}），请先取消一个已选项`)
            return
        }
        setNotice('')
        onToggle(kindOfItem, id)
    }

    const changeTab = (next: PickKind) => {
        setKind(next)
        setNotice('')
    }

    return (
        <div className="rp-overlay" onClick={onClose}>
            <div className="rp-panel" onClick={(e) => e.stopPropagation()}>
                <header className="rp-head">
                    <span className="rp-title">添加奖励</span>
                    <span className={`rp-count${full ? ' rp-count-full' : ''}`}>
                        已选 {selectedCount}/{cap}
                    </span>
                    <button className="rp-close" onClick={onClose} aria-label="关闭">
                        ×
                    </button>
                </header>
                <nav className="rp-tabs">
                    {TABS.map((t) => {
                        const n = exclude[t.kind]?.size ?? 0
                        return (
                            <button
                                key={t.kind}
                                className={`rp-tab${kind === t.kind ? ' rp-tab-active' : ''}`}
                                onClick={() => changeTab(t.kind)}
                            >
                                {t.label}
                                {n > 0 && <span className="rp-tab-badge">{n}</span>}
                            </button>
                        )
                    })}
                </nav>
                <div className="rp-search">
                    <input
                        className="rp-search-input"
                        type="search"
                        autoFocus={!isNarrowScreen()}
                        value={query}
                        placeholder="搜索名字 / 描述 / 标签"
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    {keyword && <span className="rp-search-count">{filtered.length} 项</span>}
                </div>
                <div className="rp-list">
                    {filtered.length === 0 && (
                        <div className="rp-empty">
                            {keyword
                                ? `没有匹配「${query.trim()}」的${TABS.find((t) => t.kind === kind)?.label ?? ''}`
                                : kind === 'weapon' && weaponFilter
                                  ? '当前只能选单手武器（作为副手）'
                                  : '没有更多可选'}
                        </div>
                    )}
                    {filtered.map((it) => {
                        const selected = excluded.has(it.id)
                        // 武器选项画武器本体那张（通用图 overlay），与图鉴/肉鸽选项卡同一口径
                        const weaponOverlay = it.type === 'weapon' ? getWeaponOverlay(it.id) : null
                        return (
                            <button
                                key={it.id}
                                className={`rp-item${selected ? ' rp-item-selected' : ''}`}
                                aria-pressed={selected}
                                onClick={() => handleClick(it.type, it.id, selected)}
                            >
                                {weaponOverlay && weaponOverlay.pixels.length > 0 && (
                                    <PixelCanvas overlay={weaponOverlay} className="rp-weapon-art" />
                                )}
                                <EntityItem entity={it.entity as never} type={it.type} />
                                <span className="rp-item-mark">{selected ? '已选' : ''}</span>
                            </button>
                        )
                    })}
                </div>
                <footer className="rp-foot">
                    <span className={`rp-foot-note${notice ? ' rp-foot-note-warn' : ''}`} role="status">
                        {notice || `可多选，点一次加入、再点一次取消；至多 ${cap} 项`}
                    </span>
                    <button className="rp-done" onClick={onClose}>
                        完成
                    </button>
                </footer>
            </div>
        </div>
    )
}
