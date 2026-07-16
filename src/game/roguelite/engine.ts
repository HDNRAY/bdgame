import { STORIES, getStory } from '../../data/stories/index'
import { getEvent } from '../../data/events/index'
import { buildSkeleton, applyStoryOverlay, fillEmptyNodes } from './node-layer'
import { generateRewardChoices } from './reward-gen'
import { rewardPool } from './reward-pool'
import { pickRandom } from './util'
import { END_EVENT, type Round } from '../../game/entities/round'
import { Character } from '../../engine/entities/character'
import { gen, getOpponentDef } from '../../data/opponents/index'
import { runBattle } from '../../engine/battle-runner'
import type { GameState, RogueliteEngine } from '../../engine/entities/engine'
import type { RewardType } from '../../game/entities/reward'
import type { EventDef } from '../../game/entities/event'
import type { CharacterBuild } from '../../game/entities/character-build'
import type { Tag } from '../../engine/entities/tag'

export class RogueliteRun implements RogueliteEngine {
    private _listeners = new Set<(state: GameState) => void>()
    private _state: GameState
    private _eventDef: EventDef | null = null

    constructor() {
        this._state = {
            nodeIndex: 1,
            roundIdx: 0,
            nodes: buildSkeleton(),
            rounds: [],
            build: this._defaultBuild(),
            unspentPoints: 0,
            injury: 0,
            flags: {},
            nodeLog: [],
            finished: false,
        }
        this._enterNode()
    }

    subscribe(fn: (state: GameState) => void): () => void {
        this._listeners.add(fn)
        return () => this._listeners.delete(fn)
    }

    selectChoice(choiceIndex: number): void {
        const round = this._state.rounds[this._state.rounds.length - 1]
        if (!round || choiceIndex < 0 || choiceIndex >= round.choices.length) return
        const choice = round.choices[choiceIndex]
        if (choice.setFlags) Object.assign(this._state.flags, choice.setFlags)

        switch (choice.type) {
            case 'event':
                this._startEvent(choice.id)
                break
            case 'weapon':
            case 'action':
            case 'passive':
            case 'artifact':
                this._grantReward(choice.id, choice.type)
                this._advanceRound()
                break
            case 'points':
                this._state.unspentPoints += 4
                this._state.nodeLog.push('+4 修炼点')
                this._advanceRound()
                break
            case 'heal':
                this._state.injury = Math.max(0, this._state.injury - 15)
                this._state.nodeLog.push('恢复 15 伤势')
                this._advanceRound()
                break
            case 'continue':
                if (choice.id === END_EVENT) {
                    this._finishEvent()
                } else if (this._eventDef?.id === 'pick_story') {
                    this._state.build.story = choice.id
                    this._applyStoryOverlay()
                    const story = getStory(choice.id)
                    if (story?.onNode) story.onNode(this._state, this._state.nodeIndex)
                    if (story?.reward) {
                        this._advanceRound()
                    } else {
                        this._finishEvent()
                    }
                } else {
                    this._jumpToRound(choice.id)
                }
                break
        }
        this._emit()
    }

    getState(): GameState {
        return structuredClone(this._state)
    }

    /** 更新角色数据（备战保存时调用）。 */
    updateBuild(build: CharacterBuild, remainingPoints?: number): void {
        this._state.build = build
        if (remainingPoints !== undefined) {
            this._state.unspentPoints = remainingPoints
        }
        this._emit()
    }

    // ── 内部 ──

    private _emit(): void {
        const s = structuredClone(this._state)
        for (const fn of this._listeners) fn(s)
    }

    private _defaultBuild(): CharacterBuild {
        return {
            id: 'player',
            name: '小蝌蚪',
            story: '',
            weapon: 'bare_hands',
            baseAttrs: { strength: 3, vitality: 3, agility: 3, dexterity: 3, insight: 3, wisdom: 3 },
            rewards: [],
            actionConfigs: [],
        }
    }

    // ════════════════════════════════════════
    //  节点进入
    // ════════════════════════════════════════

    private _enterNode(): void {
        this._state.rounds = []
        this._eventDef = null
        this._state.roundIdx = 0

        const story = getStory(this._state.build.story ?? '')
        if (story?.onNode) story.onNode(this._state, this._state.nodeIndex)

        const node = this._state.nodes[this._state.nodeIndex - 1]
        if (!node.eventIds || node.eventIds.length === 0) {
            console.error(`Node ${this._state.nodeIndex} has no eventIds`)
            this._finishEvent()
        } else if (node.eventIds.length > 1) {
            this._showPathChoices(node.eventIds)
        } else {
            this._startEvent(node.eventIds[0])
        }
    }

    /** 节点有多个可选事件时，生成一个选择轮让玩家挑一个。 */
    private _showPathChoices(eventIds: string[]): void {
        this._state.rounds.push({
            id: 'pick_path',
            title: `又是阳光明媚的一天`,
            description: '你决定去-',
            choices: eventIds.map((id) => {
                const ev = getEvent(id)
                return {
                    id,
                    type: 'event' as const,
                    label: ev?.name ?? id,
                    description: ev?.description,
                }
            }),
        })
    }

    // ════════════════════════════════════════
    //  开始事件
    //  统一查 registry → 有 rounds 则 pushRound, 无则自动生成
    // ════════════════════════════════════════

    private _startEvent(eventId: string): void {
        const ev = getEvent(eventId)
        if (!ev) {
            this._finishEvent()
            return
        }

        this._eventDef = ev
        this._state.roundIdx = 0

        if (ev.rounds && ev.rounds.length > 0) {
            this._pushRound(ev.rounds[0])
            return
        }

        // 无自定义 rounds → 自动生成 reward 轮次
        this._state.rounds.push({
            id: 'event_' + ev.id,
            title: ev.name,
            description: ev.description,
            choices: [],
        })
        this._fillRewardChoices(this._state.rounds[this._state.rounds.length - 1])
    }

    // ════════════════════════════════════════
    //  轮次推送
    // ════════════════════════════════════════

    private _pushRound(round: Round): void {
        const copy = { ...round, choices: [...round.choices] }
        if (round.choices.length === 0 && this._eventDef) {
            this._fillRewardChoices(copy)
        }
        if (round.enemyId) {
            this._executeCombat(copy)
        }
        this._state.rounds.push(copy)
    }

    private _fillRewardChoices(round: Round): void {
        const ev = this._eventDef
        if (!ev) return

        // pick_story: 从 STORIES 随机抽
        if (ev.id === 'pick_story') {
            if (round.id === 'pick') {
                const stories = pickRandom(STORIES, 3)
                round.choices = stories.map((s) => ({
                    id: s.id,
                    type: 'continue' as const,
                    label: s.name,
                    description: s.description,
                }))
                return
            }
            if (round.id === 'reward_show') {
                const story = getStory(this._state.build.story)
                round.choices = []
                if (story?.reward) {
                    round.choices.push({
                        id: story.reward.id,
                        type: story.reward.type,
                        label: story.reward.type === 'points' ? '4 修炼点' : story.reward.id,
                    })
                }
                return
            }
            return
        }

        // 其他: 从奖励池生成
        const exclude = this._state.build.rewards.map((r) => (typeof r === 'string' ? r : r.id))
        const playerTags = this._derivePlayerTags()
        round.choices = generateRewardChoices(ev.rewardType, playerTags, (r) => {
            if (exclude.includes(r.id)) return false
            // 招式 requiredTags 过滤
            if (r.requiredTags && r.requiredTags.length > 0) {
                if (!r.requiredTags.some((t) => playerTags.includes(t))) return false
            }
            // 自定义 rewardFilter
            return !ev.rewardFilter || ev.rewardFilter(r)
        })
    }

    /** 执行战斗轮 */
    private _executeCombat(round: Round): void {
        const enemyDef = getOpponentDef(round.enemyId ?? '')
        if (!enemyDef) return

        const player = new Character(this._state.build)
        const enemyBuild = gen(enemyDef, this._state.nodeIndex)
        const enemy = new Character(enemyBuild)

        const { winner } = runBattle(player, enemy)
        const lost = winner === enemy.id
        const injuryGained = lost ? 20 : 0

        round.result = {
            won: !lost,
            injuryGained,
            log: [],
        }

        this._state.injury += injuryGained
    }

    /** 从已有奖励中推导玩家 tags */
    private _derivePlayerTags(): Tag[] {
        const tags = new Set<Tag>()
        for (const r of this._state.build.rewards) {
            const pool = rewardPool.getPool(r.type as RewardType)
            const def = pool.find((d) => d.id === r.id)
            if (def?.tags) def.tags.forEach((t) => tags.add(t))
        }
        return [...tags]
    }

    // ════════════════════════════════════════
    //  给奖励
    // ════════════════════════════════════════

    private _grantReward(entityId: string, type: RewardType): void {
        this._state.build.rewards.push({
            id: entityId,
            name: entityId,
            type,
            description: '',
            tags: [],
        })
        if (type === 'weapon') {
            this._state.build.weapon = entityId
        }
        this._state.nodeLog.push(`${type}: ${entityId}`)
    }

    // ════════════════════════════════════════
    //  奖励后 / 跳转 / 结束 / 推进
    // ════════════════════════════════════════

    private _advanceRound(): void {
        // 自定义轮次: 进入下一轮
        if (this._eventDef?.rounds) {
            this._state.roundIdx++
            if (this._state.roundIdx < this._eventDef.rounds.length) {
                this._pushRound(this._eventDef.rounds[this._state.roundIdx])
                return
            }
        }
        this._finishEvent()
    }

    private _jumpToRound(roundId: string): void {
        const idx = this._eventDef?.rounds?.findIndex((r) => r.id === roundId)
        if (idx !== undefined && idx >= 0) {
            this._state.roundIdx = idx
            this._pushRound(this._eventDef!.rounds[idx])
        } else {
            console.error(`Round ID ${roundId} not found in event ${this._eventDef?.id}`)
            this._finishEvent()
        }
    }

    private _finishEvent(): void {
        this._advanceToNextNode()
    }

    private _advanceToNextNode(): void {
        this._state.nodeIndex++
        if (this._state.nodeIndex > 33 || this._state.injury >= 100) {
            this._state.finished = true
            this._state.rounds = []
            return
        }
        this._enterNode()
    }

    // ════════════════════════════════════════
    //  故事叠加
    // ════════════════════════════════════════

    private _applyStoryOverlay(): void {
        const story = getStory(this._state.build.story ?? '')
        if (!story) return
        this._state.build.name = story.characterName ?? this._state.build.name
        applyStoryOverlay(this._state.nodes, this._state.build.story ?? '')
        fillEmptyNodes(this._state.nodes)
    }
}
