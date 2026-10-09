// ════════════════════════════════════════
//  BottomPopups — 常驻底栏的四个使用者
//
//  设置 / 玩法 / 关于 走共用 `Modal`（居中卡片），图鉴走它的 `fullscreen` 变体。
//  **整块复用现有屏幕**（不抽内容组件、不懒加载 —— 用户已定 D7）：
//    SettingsScreen / AboutScreen / EncyclopediaScreen 三个屏幕原样塞进弹层，
//    嵌屏适配（隐藏它们自带的页首与返回钮、高度改成由弹层决定）只写在 BottomBar.scss。
//
//  四个使用者**互斥**（`active` 是单值，见 BottomBar.tsx）：
//  同一时刻只有一个挂在树上，所以不存在两层 Modal 同时监听 Esc 的问题。
//
//  `GameplayModal` 自带 `Modal` 外壳（迁移所得），这里直接渲染它；
//  图鉴的搜索框在弹层里关掉 `autoFocus`（移动端不该一打开就弹软键盘），
//  独立路由页 /encyclopedia 仍然聚焦（embedded 默认 false）。
// ════════════════════════════════════════

import { Modal } from '../../ui/Modal/Modal'
import { GameplayModal } from '../../../screens/ModeSelect/GameplayModal'
import { SettingsScreen } from '../../../screens/SettingsScreen/SettingsScreen'
import { AboutScreen } from '../../../screens/AboutScreen/AboutScreen'
import { EncyclopediaScreen } from '../../../screens/EncyclopediaScreen/EncyclopediaScreen'

export type BottomPopupKey = 'encyclopedia' | 'gameplay' | 'settings' | 'about'

interface BottomPopupsProps {
    /** 当前打开的入口（null = 全关） */
    active: BottomPopupKey | null
    onClose: () => void
}

export function BottomPopups({ active, onClose }: BottomPopupsProps) {
    if (!active) return null

    switch (active) {
        case 'gameplay':
            return <GameplayModal onClose={onClose} />
        case 'settings':
            return (
                <Modal title="设置" onClose={onClose} className="modal-embed" bodyClassName="modal-body-embed">
                    <SettingsScreen />
                </Modal>
            )
        case 'about':
            return (
                <Modal title="关于" onClose={onClose} className="modal-embed" bodyClassName="modal-body-embed">
                    <AboutScreen />
                </Modal>
            )
        case 'encyclopedia':
            return (
                <Modal
                    variant="fullscreen"
                    title="图鉴"
                    onClose={onClose}
                    className="modal-embed"
                    bodyClassName="modal-body-embed"
                >
                    <EncyclopediaScreen embedded />
                </Modal>
            )
    }
}
