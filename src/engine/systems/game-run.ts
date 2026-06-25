import {
    generateMap,
    shuffle,
    pickRandom,
    getBgChoices,
    getWeaponChoices,
    getFirstActionChoices,
    pickEventOptions,
    ALL_OPPONENT_IDS,
} from './node-gen'
import { rewardPool } from './reward-pool'
import { runBattle } from '../battle-runner'
import { Character } from '../entities/character'
import { getWeapon } from '../data/weapons'
import { getStory } from '../data/stories/index'
import { getOpponentDef, gen } from '../data/opponents/index'
import { EVENT_DB } from '../data/events/index'
import {
    isInteractiveEvent,
    isCombatEvent,
    isBossEvent,
    isHealEvent,
    isForgeEvent,
    isSimpleStoryEvent,
} from '../util/event-utils'
import type { MapNode, RunState, NodeLogEntry, GameMode, SelectionResult } from '../entities/node-map'
import type { CharacterBuild } from '../entities/character-build'
import type { Reward } from '../entities/reward'
import type { Tag } from '../entities/tag'
import type { NodeChoice } from './node-gen'
import type { EventDef, EventEffect, InteractiveEventDef, EventStep } from '../entities/event'

/**
 * 一局游戏的完整状态管理。
 */
export class GameRun {
    readonly mode: GameMode
    map: MapNode[]
    state: RunState
    private _nodeIdx = 0 // map 数组索引（0-based），getCurrentNode().index 为 1-based 节点编号
    private _enemyPool: string[] = []
    private _enemyIdx = 0
    private _currentChoices: NodeChoice[] = []
    /** 当前 event 节点的 3 个可选 eventId */
    private _currentEventIds: string[] = []
    /** 当前交互事件定义（phase === 'interactive' 时有值） */
    private _currentInteractiveEvent: InteractiveEventDef | null = null

    constructor(mode: GameMode = 'quick') {
        this.mode = mode
        this.map = generateMap()
        this.state = {
            phase: 'idle',
            build: {
                id: 'player',
                name: '挑战者',
                story: '',
                weapon: '',
                baseAttrs: { strength: 3, vitality: 3, agility: 3, dexterity: 3, insight: 3, wisdom: 3 },
                rewards: [],
            },
            unspentCultPoints: 0,
            injury: 0,
            flags: {},
            log: [],
        }
        this._enemyPool = shuffle([...ALL_OPPONENT_IDS])
    }

    // ── 查询 ──

    getCurrentNode(): MapNode {
        return this.map[this._nodeIdx]
    }
    isFinished(): boolean {
        return this.state.phase === 'finished'
    }

    /** 当前节点的选择项 */
    getSelectionItems(): NodeChoice[] {
        this._currentChoices = this._generateChoices()
        return this._currentChoices
    }

    // ── 操作 ──

    /** 选了第 index 个选项 */
    selectOption(index: number): SelectionResult {
        if (this.state.phase !== 'idle') throw new Error('selectOption called in phase: ' + this.state.phase)
        const node = this.getCurrentNode()
        const entry: NodeLogEntry = { nodeIndex: node.index, nodeType: node.type }

        switch (node.type) {
            case 'bg':
                return this._selectBg(index, entry)
            case 'weapon':
                return this._selectWeapon(index, entry)
            case 'first_action':
                return this._selectFirstAction(index, entry)
            case 'boss':
                return this._selectBoss(entry)
            case 'event':
                return this._selectEvent(index, entry)
        }
    }

    /** 选了具体奖励 */
    selectReward(rewardId: string): void {
        if (this.state.phase !== 'rewarding') throw new Error('selectReward called in phase: ' + this.state.phase)
        for (const type of ['passive', 'artifact', 'action', 'weapon'] as const) {
            const found = rewardPool.getPool(type).find((r) => r.id === rewardId)
            if (found) {
                this.state.build.rewards.push(found)
                const last = this.state.log[this.state.log.length - 1]
                if (last) last.chosenReward = found
                this._advance()
                return
            }
        }
    }

    /** 获取对手 build */
    getEnemyBuild(enemyId: string, n: number): CharacterBuild {
        const def = getOpponentDef(enemyId)
        return def ? gen(def, n) : this._fallbackBuild()
    }

    // ── 计算属性 ──

    get playerTags(): Tag[] {
        const tags = new Set<Tag>()
        if (this.state.build.weapon) {
            getWeapon(this.state.build.weapon).tags.forEach((t) => tags.add(t))
        }
        for (const r of this.state.build.rewards) {
            r.tags.forEach((t) => tags.add(t))
        }
        return [...tags]
    }

    get weaponLocked(): boolean {
        if (!this.state.build.weapon) return false
        return getWeapon(this.state.build.weapon).bound === true
    }

    get ownedRewardIds(): string[] {
        return this.state.build.rewards.map((r) => r.id)
    }

    /** 已击败的对手 ID（从 log 推导） */
    get defeatedEnemies(): string[] {
        return this.state.log.filter((e) => e.battleResult === 'win' && e.enemyId).map((e) => e.enemyId!)
    }

    // ── 内部 ──

    private _generateChoices(): NodeChoice[] {
        const node = this.getCurrentNode()
        const story = getStory(this.state.build.story ?? '')
        const override = story?.getNodeOverride?.(node.index)

        // 故事覆盖：直接返回覆盖的选择项
        if (override?.choices) return override.choices

        switch (node.type) {
            case 'bg':
                return getBgChoices()
            case 'weapon':
                return getWeaponChoices()
            case 'first_action':
                return getFirstActionChoices(this.ownedRewardIds, this.playerTags)
            case 'event':
                return this._generateEventChoices()
            case 'boss':
                return []
        }
    }

    private _generateEventChoices(): NodeChoice[] {
        this._currentEventIds = pickEventOptions({
            nodeIndex: this.getCurrentNode().index,
            storyId: this.state.build.story ?? '',
            flags: this.state.flags,
            injury: this.state.injury,
            rewardCount: this.state.build.rewards.length,
            usedEventIds: new Set(this.state.log.map((e) => e.chosenEventId ?? '')),
        })
        return this._currentEventIds.map((eid) => {
            const ev = EVENT_DB.find((e) => e.id === eid)
            if (!ev) {
                return {
                    id: eid,
                    name: eid,
                    desc: '',
                    tags: [],
                }
            }
            let desc = ''
            // 对于 story 类型的事件，检查选项后是否直接有奖励
            if (isInteractiveEvent(ev)) {
                // 这是 InteractiveEventDef，检查第一个选项后是否直接有奖励
                const firstStep = ev.steps[ev.firstStep]
                if (firstStep && firstStep.type === 'choice' && firstStep.choices && firstStep.choices.length > 0) {
                    // 检查所有 choice 是否都直接导向有奖励的结果
                    const allHaveRewards = firstStep.choices.every((choice) => {
                        const nextStepId = typeof choice.next === 'string' ? choice.next : undefined
                        if (!nextStepId) return false
                        const nextStep = ev.steps[nextStepId]
                        return nextStep && nextStep.effects?.some((e) => e.type === 'grant_reward')
                    })
                    if (allHaveRewards) {
                        desc = `🎁 ${ev.rewardType || 'reward'}`
                    } else {
                        desc = ev.description ?? ''
                    }
                } else {
                    desc = ev.description ?? ''
                }
            } else if (isCombatEvent(ev) || isBossEvent(ev)) {
                // 战斗事件直接显示奖励类型
                const rewardType = ev.rewardType
                if (rewardType) {
                    desc = `🎁 ${rewardType}`
                }
            } else if (isHealEvent(ev) || isForgeEvent(ev) || isSimpleStoryEvent(ev)) {
                // heal/forge/simple story events 显示描述
                desc = ev.description ?? ''
            }
            return {
                id: eid,
                name: ev.name ?? eid,
                desc,
                tags: [],
            }
        })
    }

    private _advance(): void {
        this._nodeIdx++
        // 故事钩子：额外修炼点
        const story = getStory(this.state.build.story ?? '')
        const cultPts = story?.getNodeOverride?.(this.getCurrentNode().index)?.cultPoints
        if (cultPts) this.state.unspentCultPoints += cultPts
        if (this._nodeIdx >= this.map.length) {
            this.state.phase = 'finished'
        } else {
            this.state.phase = 'idle'
        }
    }

    /** 取下一个对手（从 enemyPool 顺序取） */
    private _nextEnemy(): string {
        const e = this._enemyPool[this._enemyIdx]
        if (e) {
            this._enemyIdx++
            return e
        }
        return 'zhangsan'
    }

    /** 按 1-based 节点编号查询 Boss EventDef */
    private _getBossEvent(nodeIndex: number): EventDef | undefined {
        const bossMap: Record<number, string> = { 11: 'boss_phase1', 22: 'boss_phase2', 33: 'boss_final' }
        return EVENT_DB.find((e) => e.id === bossMap[nodeIndex])
    }

    /** 执行事件效果 */
    private _applyEffects(effects: EventEffect[]): void {
        for (const eff of effects) {
            switch (eff.type) {
                case 'heal':
                    this.state.injury = Math.max(0, this.state.injury - eff.value)
                    break
                case 'wound':
                    this.state.injury = Math.min(100, this.state.injury + eff.value)
                    break
                case 'cult_points':
                    this.state.unspentCultPoints += eff.value
                    break
                case 'grant_reward':
                    // 由调用方在 story 事件中处理（需要返回 rewardChoices）
                    break
                case 'set_flag':
                    this.state.flags[eff.key] = eff.value
                    break
            }
        }
    }

    // ── 各节点类型选择逻辑 ──

    private _selectBg(index: number, entry: NodeLogEntry): SelectionResult {
        const picked = this._currentChoices[Math.min(index, this._currentChoices.length - 1)]
        this.state.build.story = picked.id
        this.state.build.weapon = 'bare_hands'
        const story = getStory(picked.id)
        this.state.build.name = story?.characterName ?? '挑战者'
        const pts = story?.getNodeOverride?.(1)?.cultPoints ?? 4
        this.state.unspentCultPoints += pts
        entry.cultPointsGained = pts
        this.state.log.push(entry)
        this._advance()
        return { cultPoints: pts }
    }

    private _selectWeapon(index: number, entry: NodeLogEntry): SelectionResult {
        const picked = this._currentChoices[Math.min(index, this._currentChoices.length - 1)]
        this.state.build.weapon = picked.id
        this.state.log.push(entry)
        this._advance()
        return {}
    }

    private _selectFirstAction(index: number, entry: NodeLogEntry): SelectionResult {
        const picked = this._currentChoices[Math.min(index, this._currentChoices.length - 1)]
        const pool = rewardPool.getPool('action')
        const reward = pool.find((r) => r.id === picked.id)
        if (reward) {
            this.state.build.rewards.push(reward)
            entry.chosenReward = reward
            entry.chosenEventId = picked.id
        }
        this.state.log.push(entry)
        this._advance()
        return {}
    }

    private _selectBoss(entry: NodeLogEntry): SelectionResult {
        const bossEvent = this._getBossEvent(this.getCurrentNode().index)
        const bossId = bossEvent?.type === 'boss' ? bossEvent.enemyId : 'zhanglie'
        const { winner, engine } = runBattle(
            new Character(this.state.build),
            new Character(this.getEnemyBuild(bossId, this.getCurrentNode().index)),
        )
        entry.battleResult = winner === 'player' ? 'win' : 'lose'
        entry.enemyId = bossId
        this.state.log.push(entry)
        this.state.phase = 'finished'
        const [pc, ec] = engine.state.characters
        return {
            battleResult: entry.battleResult,
            enemyId: bossId,
            playerHp: { current: pc.hp, max: pc.maxHp },
            enemyHp: { current: ec.hp, max: ec.maxHp },
            actionCount: engine.state.actionCount,
        }
    }

    private _selectEvent(index: number, entry: NodeLogEntry): SelectionResult {
        const eid = this._currentEventIds[Math.min(index, this._currentEventIds.length - 1)]
        if (!eid) {
            this._advance()
            return {}
        }

        entry.chosenEventId = eid
        const ev = EVENT_DB.find((e) => e.id === eid)
        if (!ev) {
            this.state.log.push(entry)
            this._advance()
            return {}
        }

        const result: SelectionResult = { eventText: ev.name }
        const node = this.getCurrentNode()

        switch (ev.type) {
            case 'combat':
                this._handleCombatEvent(ev, entry, result, node)
                break
            case 'boss':
                // boss 由 _selectBoss 处理，这里不应触发
                break
            case 'heal':
            case 'forge':
                this._handleHealForgeEvent(ev, entry, result)
                break
            case 'story':
                this._handleStoryEvent(ev, entry, result)
                break
        }

        this.state.log.push(entry)
        // combat 胜利有奖励 → 等选奖励，不进 advance
        if (result.rewardChoices && result.rewardChoices.length > 0) {
            this.state.phase = 'rewarding'
            return result
        }
        // 伤势满 → 结束
        if (this.state.phase === 'finished') return result
        this._advance()
        return result
    }

    private _handleCombatEvent(ev: EventDef, entry: NodeLogEntry, result: SelectionResult, node: MapNode): void {
        if (ev.type !== 'combat') return
        const enemyId = ev.enemyId ?? this._nextEnemy()
        entry.enemyId = enemyId
        const { winner, engine } = runBattle(
            new Character(this.state.build),
            new Character(this.getEnemyBuild(enemyId, node.index)),
        )
        entry.battleResult = winner === 'player' ? 'win' : 'lose'
        result.battleResult = entry.battleResult
        result.enemyId = enemyId

        // 战斗统计
        const [pc, ec] = engine.state.characters
        result.playerHp = { current: pc.hp, max: pc.maxHp }
        result.enemyHp = { current: ec.hp, max: ec.maxHp }
        result.actionCount = engine.state.actionCount

        if (winner === 'player') {
            // 奖励
            const rewardType = ev.rewardType ?? pickRandom(['cult', 'passive', 'artifact', 'action'] as const, 1)[0]
            result.rewardChoices = this._pickReward(rewardType)
        } else {
            // 伤势
            const hpLostRatio = 1 - pc.hp / pc.maxHp
            const wound = Math.round(2 + hpLostRatio * 10)
            this.state.injury = Math.min(100, this.state.injury + wound)
            entry.injuryGained = wound
            if (this.state.injury >= 100) {
                this.state.phase = 'finished'
            }
        }
    }

    private _handleHealForgeEvent(ev: EventDef, entry: NodeLogEntry, result: SelectionResult): void {
        if (ev.type !== 'heal' && ev.type !== 'forge') return
        this._applyEffects(ev.effects ?? [])
        entry.injuryGained = ev.effects.find((e) => e.type === 'heal')?.value ?? 0
        const cpts = ev.effects.find((e) => e.type === 'cult_points')?.value
        if (cpts) {
            entry.cultPointsGained = cpts
            result.cultPoints = cpts
        }
    }

    private _handleStoryEvent(ev: EventDef, entry: NodeLogEntry, result: SelectionResult): void {
        if (ev.type !== 'story') return
        // 交互事件系统（多层选择 + 叙事）
        if (isInteractiveEvent(ev)) {
            this._enterInteractive(ev)
            return
        }
        // 非交互式故事事件：直接应用效果（已缩小为 StoryEventDef）
        if (isSimpleStoryEvent(ev)) {
            this._applyEffects(ev.effects ?? [])
            const grant = (ev.effects ?? []).find((e: EventEffect) => e.type === 'grant_reward')
            if (grant?.type === 'grant_reward') {
                result.rewardChoices = this._pickReward(grant.rewardType)
            }
        }
    }

    private _pickReward(rt: string): Reward[] {
        if (this.weaponLocked && rt === 'weapon') return []
        if (rt === 'cult') return []
        const type = rt as 'passive' | 'artifact' | 'action' | 'weapon'
        return rewardPool.pickChoices(type, 3, this.ownedRewardIds, this.playerTags)
    }

    /** 进入交互事件（多层选择 + 叙事） */
    private _enterInteractive(eventDef: InteractiveEventDef): void {
        this._currentInteractiveEvent = eventDef
        this.state.phase = 'interactive'
        this.state.currentInteractive = {
            eventId: eventDef.id,
            currentStepId: eventDef.firstStep,
            history: [],
        }
    }

    /** 获取当前交互步骤 */
    getInteractiveStep(): EventStep | null {
        if (!this.state.currentInteractive || !this._currentInteractiveEvent) return null
        return this._currentInteractiveEvent.steps[this.state.currentInteractive.currentStepId] ?? null
    }

    /** 推进交互事件：选择一个选项 */
    advanceInteractive(choiceIndex: number): SelectionResult {
        const result: SelectionResult = {}
        if (!this.state.currentInteractive || !this._currentInteractiveEvent) return result

        const step = this.getInteractiveStep()
        if (!step) return result

        if (step.type === 'narrative') {
            // narrative 步骤：无条件推进到下一步
            const nextStep = step.next
            if (!nextStep) {
                // 事件结束，推进到下一个阶段
                this.state.currentInteractive = undefined
                this._advance()
                return result
            }

            if (typeof nextStep === 'string') {
                this.state.currentInteractive.currentStepId = nextStep
            } else {
                // Record 类型分支（不应该在 narrative 中出现，但以防万一）
                const stepId = nextStep['0'] ?? nextStep['default'] ?? this._currentInteractiveEvent!.firstStep
                this.state.currentInteractive.currentStepId = stepId
            }
            return result
        }

        if (step.type !== 'choice') return result

        const choice = step.choices?.[choiceIndex]
        if (!choice) return result

        // 记录选择
        this.state.currentInteractive.history.push({
            stepId: this.state.currentInteractive.currentStepId,
            choiceIndex,
        })

        // 应用选择效果（可能有 chance）
        let effects = choice.success ?? []
        if (choice.chance !== undefined && Math.random() > choice.chance) {
            effects = choice.failure ?? []
        }
        this._applyEffects(effects)

        // 决定下一步
        const nextStep = choice.next
        if (!nextStep) {
            // 事件结束，推进到下一个阶段
            this.state.currentInteractive = undefined
            this._advance()
            return result
        }

        if (typeof nextStep === 'string') {
            // 线性分支
            this.state.currentInteractive.currentStepId = nextStep
        } else {
            // 条件分支 Record<choiceIndex, stepId>
            const indexKey = String(choiceIndex)
            this.state.currentInteractive.currentStepId =
                nextStep[indexKey] ?? nextStep['default'] ?? nextStep['0'] ?? this._currentInteractiveEvent!.firstStep
        }

        return result
    }

    private _fallbackBuild(): CharacterBuild {
        return gen(getOpponentDef(pickRandom(ALL_OPPONENT_IDS, 1)[0])!, 1)
    }
}
