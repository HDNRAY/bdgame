import { useRef, useReducer, useCallback, useState } from 'react'
import { GameRun } from '../../engine/systems/game-run'
import type { SelectionResult } from '../../engine/entities/node-map'
import type { NodeChoice } from '../../engine/systems/node-gen'
import type { CharacterBuild } from '../../engine/entities/character-build'

/**
 * useGameRun — 引擎与 React 的连接层。
 *
 * GameRun 实例稳定不变（useRef），每次操作后通过 tick 触发重渲染。
 * UI 缓存（choices / lastResult）由 hook 管理，引擎不存。
 */
export function useGameRun() {
    const runRef = useRef<GameRun>(new GameRun('quick'))
    const [, tick] = useReducer((n: number) => n + 1, 0)

    // ── UI 缓存 ──
    const [choices, setChoices] = useState<NodeChoice[]>([])
    const [lastResult, setLastResult] = useState<SelectionResult | null>(null)

    /** 进入当前节点（phase === 'idle' 时调用） */
    const enterNode = useCallback(() => {
        if (runRef.current.state.phase !== 'idle') return
        const items = runRef.current.getSelectionItems()
        setChoices(items)
        setLastResult(null)
        tick()
    }, [])

    /** 选第 n 个选项 */
    const select = useCallback((index: number) => {
        const res = runRef.current.selectOption(index)
        setLastResult(res)
        setChoices([])
        tick()
    }, [])

    /** 选奖励 */
    const selectReward = useCallback((rewardId: string) => {
        runRef.current.selectReward(rewardId)
        setLastResult(null)
        // 选完奖励后，自动加载下一个节点的选项
        if (runRef.current.state.phase === 'idle') {
            const items = runRef.current.getSelectionItems()
            setChoices(items)
        } else {
            setChoices([])
        }
        tick()
    }, [])

    /** 更新 build 和 unspentCultPoints */
    const updateBuild = useCallback((newBuild: CharacterBuild, unspentCultPoints: number) => {
        runRef.current.state.build = newBuild
        runRef.current.state.unspentCultPoints = unspentCultPoints
        tick()
    }, [])

    /** 在交互事件中选择一个选项 */
    const selectEventChoice = useCallback((choiceIndex: number) => {
        if (runRef.current.state.phase !== 'interactive') return
        const res = runRef.current.advanceInteractive(choiceIndex)
        setLastResult(res)
        tick()
    }, [])

    return {
        run: runRef,
        choices,
        lastResult,
        enterNode,
        select,
        selectReward,
        updateBuild,
        selectEventChoice,
    }
}
