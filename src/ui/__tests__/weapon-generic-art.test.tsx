/**
 * 「展示武器本体」的统一口径：图鉴卡 / 肉鸽奖励选项画的都必须是**通用图**
 * （`getWeaponOverlay`），不是逐姿势取图（`getWeaponArt`）——后者是「握在手上」的形态。
 *
 * 通用图与逐姿势图在画布尺寸上完全一样（图标模式固定按 32×32 网格开画布），SSR 也拿不到
 * canvas 里的像素，所以这里记录取图调用本身：退回旧写法（根本不画，或改传 weaponId 走
 * 逐姿势取图）就会红。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import type * as pixelSprites from '../pixel-sprites'
import { getWeaponArt, getWeaponOverlay } from '../pixel-sprites'
import { RoundCard } from '../components/roguelite/RoundCard'
import { EncyclopediaScreen } from '../screens/EncyclopediaScreen/EncyclopediaScreen'
import type { Round } from '../../game/entities/round'

/** 素手无相：既有通用图（白玉环），也有逐姿势图（甲片），两张确实不同 */
const WEAPON_ID = 'iron_back_hand'

const spies = vi.hoisted(() => ({ overlay: vi.fn(), art: vi.fn() }))

vi.mock('../pixel-sprites', async (importOriginal) => {
    const actual = (await importOriginal()) as typeof pixelSprites
    return {
        ...actual,
        getWeaponOverlay: (id: string) => {
            spies.overlay(id)
            return actual.getWeaponOverlay(id)
        },
        getWeaponArt: (id: string, pose: string) => {
            spies.art(id, pose)
            return actual.getWeaponArt(id, pose)
        },
    }
})

/** Tooltip 走 createPortal 挂到 document.body，SSR 里没有 document；这里只保留子节点 */
vi.mock('../components/ui/Tooltip/Tooltip', () => ({
    Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

/** 肉鸽奖励：单选项走 ChoiceButton（无描述 → 打字机直接 done，SSR 里也能看到选项卡） */
const rewardRound: Round = {
    id: 'r-reward',
    title: '奖励',
    choices: [{ id: WEAPON_ID, type: 'weapon', label: '素手无相' }],
}

beforeEach(() => {
    spies.overlay.mockClear()
    spies.art.mockClear()
})

describe('武器展示口径：通用图', () => {
    it('测试所用武器的通用图与逐姿势图确实不同（否则下面的断言没有意义）', () => {
        expect(getWeaponArt(WEAPON_ID, 'idle')?.pixels).not.toEqual(getWeaponOverlay(WEAPON_ID).pixels)
    })

    it('肉鸽奖励选项里的武器按通用图取图', () => {
        const html = renderToStaticMarkup(<RoundCard round={rewardRound} onChoice={() => {}} />)
        expect(html).toContain('rc-weapon-art')
        expect(spies.overlay).toHaveBeenCalledWith(WEAPON_ID)
        expect(spies.art).not.toHaveBeenCalledWith(WEAPON_ID, expect.anything())
    })

    it('图鉴的武器卡按通用图取图', () => {
        const html = renderToStaticMarkup(
            <MemoryRouter>
                <EncyclopediaScreen />
            </MemoryRouter>,
        )
        expect(html).toContain('encyclopedia-weapon-art')
        expect(spies.overlay).toHaveBeenCalledWith(WEAPON_ID)
        expect(spies.art).not.toHaveBeenCalledWith(WEAPON_ID, expect.anything())
    })
})
