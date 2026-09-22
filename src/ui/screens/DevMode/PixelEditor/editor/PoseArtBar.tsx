import { POSE_NAMES } from '../../../../pixel-sprites'
import { WEAPON_BASE_SLOT } from './constants'

export interface PoseArtBarProps {
    /** 当前编辑的槽：'base' = 通用图（overlay），其余是姿势名 */
    current: string
    /** 每个姿势有没有画（决定按钮上的「已 / 未」与已填样式） */
    filled: Record<string, boolean>
    /** 通用图有没有画 */
    baseFilled: boolean
    /** 点姿势按钮：切到那个槽编辑（当前内容留在原槽，不串） */
    onSelect: (slot: string) => void
    /** 复制当前→其它（当前 = 通用图时铺到六个姿势；当前 = 姿势时铺到其它五个） */
    onCopyToOthers: () => void
    /** 清空本站势（姿势清空后渲染坍缩到 idle / 通用图） */
    onClearCurrent: () => void
}

/**
 * 武器图模式画布上方的「逐姿势美术」工具条：通用图 + 六个姿势 + 两个批量动作。
 * 按钮沿用 `pixel-editor-tool` 外观；已画的姿势多一个 `filled` 样式与「已」标记。
 */
export function PoseArtBar({
    current,
    filled,
    baseFilled,
    onSelect,
    onCopyToOthers,
    onClearCurrent,
}: PoseArtBarProps) {
    return (
        <div className="pixel-editor-art-bar">
            <div className="pixel-editor-art-pose-grid">
                <button
                    className={`pixel-editor-tool ${current === WEAPON_BASE_SLOT ? 'active' : ''} ${baseFilled ? 'filled' : ''}`}
                    title="通用图（overlay）：没有逐姿势美术时，所有姿势都用它；有姿势图时它是坍缩的最后一层"
                    onClick={() => onSelect(WEAPON_BASE_SLOT)}
                >
                    通用
                    <span className="pixel-editor-pose-mark">{baseFilled ? '已' : '未'}</span>
                </button>
                {POSE_NAMES.map((pose) => (
                    <button
                        key={pose}
                        className={`pixel-editor-tool ${current === pose ? 'active' : ''} ${filled[pose] ? 'filled' : ''}`}
                        title={`编辑「${pose}」姿势的那张图${
                            filled[pose] ? '（已画）' : '（未画：渲染时坍缩到 idle，再坍缩到通用图）'
                        }`}
                        onClick={() => onSelect(pose)}
                    >
                        {pose}
                        <span className="pixel-editor-pose-mark">{filled[pose] ? '已' : '未'}</span>
                    </button>
                ))}
                <button
                    className="pixel-editor-tool pixel-editor-art-action"
                    title="把当前槽的图铺到其它姿势（会覆盖它们现有的图），省得重画"
                    onClick={onCopyToOthers}
                >
                    复制当前→其它
                </button>
                <button
                    className="pixel-editor-tool pixel-editor-art-action"
                    title="清空当前槽的图：姿势清空后渲染会坍缩到 idle / 通用图，导出时也不写这一块"
                    onClick={onClearCurrent}
                >
                    清空本站势
                </button>
            </div>
        </div>
    )
}
