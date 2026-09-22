import type { Dispatch, SetStateAction } from 'react'
import { WEAPON_ARTS, WEAPON_OVERLAYS, formatCharacterColorsSnippet } from '../../../../pixel-sprites'
import type { CharacterColors } from '../../../../pixel-sprites/palette'
import { SearchSelect } from '../../../../components/ui/SearchSelect/SearchSelect'
import { CHARACTER_IDS, NAME_BY_ID, SLOT_LABELS, SLOT_TIPS, SLOT_TO_COLOR_KEY, WEAPON_NAME } from './constants'
import type { EditorMode } from './constants'

export interface PalettePanelProps {
    mode: EditorMode
    /** 面板里露出的色块下标 */
    slotList: number[]
    slot: number
    selectSlot: (next: number) => void
    /** 颜色查询：0 = 空 */
    colorOf: (v: number) => string | undefined
    weaponPalette: string[]
    /** 当前角色的有效配色（登记值 + 编辑器里的改动） */
    effectiveColors: CharacterColors
    charId: string
    setCharId: (id: string) => void
    colorOverridden: boolean
    missingSlots: number[]
    fixedSlotOverrides: Record<number, string>
    setFixedSlotOverrides: Dispatch<SetStateAction<Record<number, string>>>
    setColorOverrides: Dispatch<SetStateAction<Record<string, Partial<CharacterColors>>>>
    setStatus: (msg: string) => void
    copy: (text: string, note: string) => void
    setWeaponColorAt: (idx: number, color: string) => void
    removeWeaponColor: (idx: number) => void
    addWeaponColor: () => void
    previewWeaponId: string
    setPreviewWeaponId: (id: string) => void
}

/** 右侧「调色板」面板：槽位色块 / 角色配色 / 配色片段 / 预览武器 */
export function PalettePanel({
    mode,
    slotList,
    slot,
    selectSlot,
    colorOf,
    weaponPalette,
    effectiveColors,
    charId,
    setCharId,
    colorOverridden,
    missingSlots,
    fixedSlotOverrides,
    setFixedSlotOverrides,
    setColorOverrides,
    setStatus,
    copy,
    setWeaponColorAt,
    removeWeaponColor,
    addWeaponColor,
    previewWeaponId,
    setPreviewWeaponId,
}: PalettePanelProps) {
    return (
        <section className="pixel-editor-panel">
            <h3
                title={
                    mode === 'frame'
                        ? '槽位：颜色含义由角色配色决定，数字就是导出的槽位号'
                        : '自由配色：颜色随便加，导出时写进武器的 palette'
                }
            >
                调色板
            </h3>
            <div className="pixel-editor-palette">
                {slotList.map((i) => (
                    <span key={i} className="pixel-editor-swatch-wrap">
                        <button
                            className={`pixel-editor-swatch ${slot === i ? 'active' : ''}`}
                            title={
                                mode === 'frame'
                                    ? (SLOT_TIPS[i] ?? `槽位 ${i}`)
                                    : `颜色 ${i}（${weaponPalette[i] ?? ''}）`
                            }
                            onClick={() => selectSlot(i)}
                        >
                            <span
                                className="pixel-editor-swatch-color"
                                style={{ background: colorOf(i) ?? 'transparent' }}
                            />
                            {mode === 'frame' && (
                                <span className="pixel-editor-swatch-label">{SLOT_LABELS[i] ?? i}</span>
                            )}
                        </button>
                        {mode === 'frame' && !SLOT_TO_COLOR_KEY[i] && i !== 0 && (
                            <span className="pixel-editor-swatch-tools">
                                <input
                                    type="color"
                                    title={`改「${SLOT_LABELS[i]}」的颜色（槽位 ${i}；只影响编辑器预览）`}
                                    value={colorOf(i) ?? '#000000'}
                                    onChange={(e) =>
                                        setFixedSlotOverrides((prev) => ({ ...prev, [i]: e.target.value }))
                                    }
                                />
                            </span>
                        )}
                        {mode === 'frame' && SLOT_TO_COLOR_KEY[i] && (
                            <span className="pixel-editor-swatch-tools">
                                <input
                                    type="color"
                                    title={`改「${SLOT_LABELS[i]}」的颜色（只影响编辑器预览；用下面的「复制配色片段」落回 palette.ts）`}
                                    value={effectiveColors[SLOT_TO_COLOR_KEY[i]]}
                                    onChange={(e) =>
                                        setColorOverrides((prev) => ({
                                            ...prev,
                                            [charId]: { ...prev[charId], [SLOT_TO_COLOR_KEY[i]]: e.target.value },
                                        }))
                                    }
                                />
                            </span>
                        )}
                        {mode === 'weapon' && (
                            <span className="pixel-editor-swatch-tools">
                                <input
                                    type="color"
                                    title="改这个颜色"
                                    value={
                                        /^#[0-9a-f]{6}$/i.test(weaponPalette[i] ?? '')
                                            ? (weaponPalette[i] as string)
                                            : '#ffffff'
                                    }
                                    onChange={(e) => setWeaponColorAt(i, e.target.value)}
                                />
                                <button title="删掉这个颜色（没在用才可以删）" onClick={() => removeWeaponColor(i)}>
                                    ×
                                </button>
                            </span>
                        )}
                    </span>
                ))}
                {mode === 'weapon' && (
                    <button className="pixel-editor-tool" title="加一个颜色" onClick={addWeaponColor}>
                        + 加色
                    </button>
                )}
            </div>
            {mode === 'frame' && missingSlots.length > 0 && (
                <p className="pixel-editor-warn">
                    角色调色板缺槽位 {missingSlots.join('/')}，已用兜底色（刷新页面即可）
                </p>
            )}
            {mode === 'frame' && (
                <div className="pixel-editor-field" title="配色预览：槽位色随角色变化；发色/皮肤/瞳色/衣物/装饰都可以改">
                    <span>角色配色</span>
                    <SearchSelect
                        value={charId}
                        options={CHARACTER_IDS.map((id) => ({ value: id, label: NAME_BY_ID[id] ?? id }))}
                        onChange={setCharId}
                        searchPlaceholder="搜索角色…"
                    />
                </div>
            )}
            {mode === 'frame' && (
                <div className="pixel-editor-row">
                    <span
                        className="pixel-editor-colorline"
                        title="改过的角色配色（发色等）；没改过的槽位维持 palette.ts 的登记值"
                    >
                        {colorOverridden ? '配色已改动' : '配色＝palette.ts 登记值'}
                    </span>
                    <button
                        className="pixel-editor-btn"
                        title="复制这段粘进 palette.ts 的 CHARACTER_COLORS，改色就落到代码里"
                        onClick={() => copy(formatCharacterColorsSnippet(charId, effectiveColors), '配色片段已复制')}
                    >
                        复制配色片段
                    </button>
                    <button
                        className="pixel-editor-btn"
                        disabled={!colorOverridden}
                        title="丢弃本角色的改色，回到 palette.ts 的登记值"
                        onClick={() => {
                            setColorOverrides((prev) => {
                                const next = { ...prev }
                                delete next[charId]
                                return next
                            })
                            setFixedSlotOverrides({})
                            setStatus(`「${NAME_BY_ID[charId] ?? charId}」的配色已恢复为 palette.ts 的登记值`)
                        }}
                    >
                        重置配色
                    </button>
                </div>
            )}
            {mode === 'frame' && (
                <details className="pixel-editor-code">
                    <summary title="展开看配色对应的 palette.ts 文本（剪贴板不可用时从这里手动复制）">
                        查看配色代码
                    </summary>
                    <textarea
                        className="pixel-editor-textarea pixel-editor-textarea--export"
                        readOnly
                        rows={1}
                        value={formatCharacterColorsSnippet(charId, effectiveColors)}
                    />
                    {Object.keys(fixedSlotOverrides).length > 0 && (
                        <textarea
                            className="pixel-editor-textarea pixel-editor-textarea--export"
                            readOnly
                            rows={3}
                            title="固定槽位（描边/白/金边）改动的落点：palette.ts 的 buildPalette / 主题描边常量"
                            value={[
                                `// palette.ts · buildPalette 里的固定槽位`,
                                `'1': '${colorOf(1) ?? '#000000'}', '7': '${colorOf(7) ?? '#ffffff'}', '9': '${colorOf(9) ?? '#ffd24a'}',`,
                                `// 描边想换：改 SPRITE_OUTLINE_LIGHT（浅色主题）/ SPRITE_OUTLINE_DARK（深色主题）`,
                            ].join('\n')}
                        />
                    )}
                </details>
            )}
            {mode === 'frame' && (
                <div className="pixel-editor-field" title="预览里挂的武器">
                    <span>预览武器</span>
                    <SearchSelect
                        value={previewWeaponId}
                        options={Array.from(
                            new Set([...Object.keys(WEAPON_OVERLAYS), ...Object.keys(WEAPON_ARTS)]),
                        ).map((id) => ({
                            value: id,
                            label: WEAPON_NAME[id] ?? id,
                        }))}
                        onChange={setPreviewWeaponId}
                        searchPlaceholder="搜索武器…"
                    />
                </div>
            )}
        </section>
    )
}
