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
import type { MapNode, RunState, NodeLogEntry } from '../entities/node-map'
import type { CharacterBuild } from '../entities/character-build'
import type { Reward } from '../entities/reward'
import type { Tag } from '../entities/tag'
import type { NodeChoice } from './node-gen'
import type { EventDef, EventEffect } from '../entities/event'

type GameMode = 'quick' | 'normal'

/** selectOption 返回值（兼容现有 UI） */
export interface SelectionResult {
    battleResult?: 'win' | 'lose'
    enemyId?: string
    eventText?: string
    rewardChoices?: Reward[]
    cultPoints?: number
    /** 战斗统计 */
    playerHp?: { current: number; max: number }
    enemyHp?: { current: number; max: number }
    actionCount?: number
}

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

    constructor(mode: GameMode = 'quick') {
        this.mode = mode
        this.map = generateMap()
        this.state = {
            build: {
                id: 'player',
                name: '挑战者',
                story: '',
                weapon: '',
                baseAttrs: { strength: 3, vitality: 3, agility: 3, dexterity: 3, insight: 3, wisdom: 3 },
                rewards: [],
            },
            unspentCultPoints: 4,
            injury: 0,
            flags: {},
            log: [],
            finished: false,
        }
        this._enemyPool = shuffle([...ALL_OPPONENT_IDS])
    }

    // ── 查询 ──

    getCurrentNode(): MapNode {
        return this.map[this._nodeIdx]
    }
    isFinished(): boolean {
        return this.state.finished
    }

    /** 当前节点的选择项 */
    getSelectionItems(): NodeChoice[] {
        this._currentChoices = this._generateChoices()
        return this._currentChoices
    }

    // ── 操作 ──

    /** 选了第 index 个选项 */
    selectOption(index: number): SelectionResult {
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
        for (const type of ['passive', 'artifact', 'action', 'weapon'] as const) {
            const found = rewardPool.getPool(type).find((r) => r.id === rewardId)
            if (found) {
                this.state.build.rewards.push(found)
                const last = this.state.log[this.state.log.length - 1]
                if (last) last.chosenReward = found
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
            case 'event': {
                this._currentEventIds = pickEventOptions({
                    nodeIndex: node.index,
                    storyId: this.state.build.story ?? '',
                    flags: this.state.flags,
                    injury: this.state.injury,
                    rewardCount: this.state.build.rewards.length,
                    usedEventIds: new Set(this.state.log.map((e) => e.chosenEventId ?? '')),
                })
                return this._currentEventIds.map((eid) => {
                    const ev = EVENT_DB.find((e) => e.id === eid)
                    return {
                        id: eid,
                        name: ev?.name ?? eid,
                        desc: ev?.name ?? '',
                        tags: [],
                    }
                })
            }
            case 'boss':
                return []
        }
    }

    private _advance(): void {
        this._nodeIdx++
        // 故事钩子：额外修炼点
        const story = getStory(this.state.build.story ?? '')
        const cultPts = story?.getNodeOverride?.(this.getCurrentNode().index)?.cultPoints
        if (cultPts) this.state.unspentCultPoints += cultPts
        if (this._nodeIdx >= this.map.length) this.state.finished = true
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
        const story = getStory(picked.id)
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
        this.state.finished = true
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

        switch (ev.type) {
            case 'combat': {
                const enemyId = ev.enemyId ?? this._nextEnemy()
                entry.enemyId = enemyId
                const { winner, engine } = runBattle(
                    new Character(this.state.build),
                    new Character(this.getEnemyBuild(enemyId, this.getCurrentNode().index)),
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
                    const rewardType =
                        ev.rewardType ?? pickRandom(['cult', 'passive', 'artifact', 'action'] as const, 1)[0]
                    result.rewardChoices = this._pickReward(rewardType)
                } else {
                    // 伤势
                    const hpLostRatio = 1 - pc.hp / pc.maxHp
                    const wound = Math.round(2 + hpLostRatio * 10)
                    this.state.injury = Math.min(100, this.state.injury + wound)
                    entry.injuryGained = wound
                    if (this.state.injury >= 100) {
                        this.state.finished = true
                    }
                }
                break
            }
            case 'boss': {
                // boss 由 _selectBoss 处理，这里不应触发
                break
            }
            case 'heal':
            case 'forge': {
                this._applyEffects(ev.effects ?? [])
                entry.injuryGained = ev.effects.find((e) => e.type === 'heal')?.value ?? 0
                const cpts = ev.effects.find((e) => e.type === 'cult_points')?.value
                if (cpts) {
                    entry.cultPointsGained = cpts
                    result.cultPoints = cpts
                }
                break
            }
            case 'story': {
                // 有选项的故事事件：默认选第一个
                if (ev.choices && ev.choices.length > 0) {
                    const choice = ev.choices[0]
                    this._applyEffects(choice.effects ?? [])
                    result.eventText = choice.description
                    const grant = (choice.effects ?? []).find((e) => e.type === 'grant_reward')
                    if (grant?.type === 'grant_reward') {
                        result.rewardChoices = this._pickReward(grant.rewardType)
                    }
                } else {
                    this._applyEffects(ev.effects ?? [])
                    const grant = (ev.effects ?? []).find((e) => e.type === 'grant_reward')
                    if (grant?.type === 'grant_reward') {
                        result.rewardChoices = this._pickReward(grant.rewardType)
                    }
                }
                break
            }
        }

        this.state.log.push(entry)
        this._advance()
        return result
    }

    private _pickReward(rt: string): Reward[] {
        if (this.weaponLocked && rt === 'weapon') return []
        if (rt === 'cult') return []
        const type = rt as 'passive' | 'artifact' | 'action' | 'weapon'
        return rewardPool.pickChoices(type, 3, this.ownedRewardIds, this.playerTags)
    }

    private _fallbackBuild(): CharacterBuild {
        return gen(getOpponentDef(pickRandom(ALL_OPPONENT_IDS, 1)[0])!, 1)
    }
}
