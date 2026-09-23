import { WEAPON_HEIGHT, WEAPON_WIDTH } from '../../../../pixel-sprites'
import type { PixelMap } from '../../../../pixel-sprites'
import { PixelCanvas } from '../../../../components/ui/PixelCanvas/PixelCanvas'
import type { EditorMode } from './constants'
import { padForPreview } from './utils'

export interface EditorPreviewProps {
    mode: EditorMode
    /** 身体帧源图（未补留白） */
    map: PixelMap
    /** 身体帧调色板（槽位号 → 色值） */
    framePalette: Record<string, string>
    /** 预览用的姿势（决定武器挂点） */
    poseName: string
    previewWeaponId: string
    /** 武器图网格 + 调色板（武器模式预览用） */
    weaponGrid: PixelMap
    weaponPalette: string[]
    backdrop: { a: string; b: string }
}

/** 底部「预览」行：身体帧按 60×48 渲染并挂预览武器；武器模式看原图 */
export function EditorPreview({
    mode,
    map,
    framePalette,
    poseName,
    previewWeaponId,
    weaponGrid,
    weaponPalette,
    backdrop,
}: EditorPreviewProps) {
    return (
        <div className="pixel-editor-preview-row">
            <span
                className="pixel-editor-preview-label"
                title={
                    mode === 'frame'
                        ? '预览：身体帧按 60×48 渲染（补左侧留白）并挂上预览武器'
                        : '预览：武器原图（32×32），与游戏里的角度/握点无关'
                }
            >
                预览
            </span>
            {mode === 'frame' ? (
                <PixelCanvas
                    pixels={padForPreview(map)}
                    palette={framePalette}
                    scale={3}
                    pose={poseName}
                    weaponId={previewWeaponId}
                    // 不传 overlay：PixelCanvas 按 weaponId + pose 走逐姿势取图（art[pose] → art.idle → overlay）
                    // 与「像素图测试」同视口：120×54，人偏右，挥砍时不裁武器
                    canvasCols={120}
                    canvasRows={54}
                    contentOffsetX={45}
                    backdrop={backdrop}
                    className="pixel-editor-preview-canvas"
                />
            ) : (
                <PixelCanvas
                    pixels={weaponGrid}
                    palette={Object.fromEntries(Array.from(weaponPalette, (c, i) => [String(i), c || 'transparent']))}
                    scale={5}
                    canvasCols={WEAPON_WIDTH}
                    canvasRows={WEAPON_HEIGHT}
                    contentOffsetX={0}
                    backdrop={backdrop}
                    className="pixel-editor-preview-canvas pixel-editor-preview-canvas--weapon"
                />
            )}
        </div>
    )
}
