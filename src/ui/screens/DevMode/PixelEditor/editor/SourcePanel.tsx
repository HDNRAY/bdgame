import { POSE_NAMES } from '../../../../pixel-sprites'
import { SearchSelect } from '../../../../components/ui/SearchSelect/SearchSelect'
import { BUILTIN_FRAMES, WEAPON_IDS_WITH_ART, WEAPON_NAME } from './constants'
import type { EditorMode } from './constants'

export interface SourcePanelProps {
    mode: EditorMode
    /** 身体帧：当前底稿（内置帧 key） */
    sourceKey: string
    onLoadBuiltinFrame: (key: string) => void
    poseName: string
    onPoseNameChange: (pose: string) => void
    constName: string
    onConstNameChange: (name: string) => void
    /** 武器图：当前底稿武器 id */
    weaponId: string
    onLoadWeapon: (id: string) => void
}

/** 右侧第一块面板：载入底稿（内置帧 / 已有武器）+ 姿势 + 导出常量名 */
export function SourcePanel({
    mode,
    sourceKey,
    onLoadBuiltinFrame,
    poseName,
    onPoseNameChange,
    constName,
    onConstNameChange,
    weaponId,
    onLoadWeapon,
}: SourcePanelProps) {
    return (
        <section className="pixel-editor-panel">
            {mode === 'frame' ? (
                <>
                    <div className="pixel-editor-field" title="载入现成的帧当底稿（源图 48×48）">
                        <span>底稿</span>
                        <SearchSelect
                            value={sourceKey}
                            options={BUILTIN_FRAMES.map((f) => ({ value: f.key, label: f.label }))}
                            onChange={onLoadBuiltinFrame}
                            searchPlaceholder="搜索帧…"
                        />
                    </div>
                    <div className="pixel-editor-field" title="锚点与预览使用哪个姿势；导出锚点片段也用它">
                        <span>姿势</span>
                        <select value={poseName} onChange={(e) => onPoseNameChange(e.target.value)}>
                            {POSE_NAMES.map((p) => (
                                <option key={p} value={p}>
                                    {p}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="pixel-editor-field" title="导出片段的常量名">
                        <span>常量名</span>
                        <input
                            type="text"
                            value={constName}
                            onChange={(e) => onConstNameChange(e.target.value)}
                            spellCheck={false}
                        />
                    </div>
                </>
            ) : (
                <div className="pixel-editor-field" title="载入已有武器美术当底稿（32×32）">
                    <span>武器</span>
                    <SearchSelect
                        value={weaponId}
                        options={WEAPON_IDS_WITH_ART.map((id) => ({ value: id, label: WEAPON_NAME[id] ?? id }))}
                        onChange={onLoadWeapon}
                        searchPlaceholder="搜索武器…"
                    />
                </div>
            )}
        </section>
    )
}
