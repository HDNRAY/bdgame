import { STORIES, getStory } from '../../data/stories/index'
import { getEvent } from '../../data/events/index'
import { buildSkeleton, applyStoryOverlay, fillEmptyNodes, applyTournamentLayer } from './node-layer'
import { processTournament, TOURNAMENT_EVENT_IDS } from '../tournament/integration'
import { CULT_REWARD, MAX_POINTS_REWARDS } from '../entities/reward'
import { generateRewardChoices } from './reward-gen'
import { rewardPool } from './reward-pool'
import { pickRandom, resolveQuotaRewardType, countRewardOpportunities } from './util'
import { getArtifact } from '../../data/artifacts'
import { getPassive } from '../../data/passives'
import { WEAPON_DB } from '../../data/weapons/weapons'
import { STARTING_WEAPONS } from '../../data/weapons/starting-weapons'
import { END_EVENT, type Round } from '../../game/entities/round'
import { Character } from '../../engine/entities/character'
import { gen, getOpponentDef } from '../../data/opponents/index'
import { runBattle } from '../../engine/battle-runner'
import type { GameState, RogueliteEngine } from '../../engine/entities/engine'
import type { RewardType } from '../../game/entities/reward'
import type { EventDef } from '../../game/entities/event'
import type { StoryDef } from '../../game/entities/story'
import type { CharacterBuild } from '../../game/entities/character-build'
import type { Tag } from '../../engine/entities/tag'

export class RogueliteRun implements RogueliteEngine {
    private _listeners = new Set<(state: GameState) => void>()
    private _state: GameState
    private _eventDef: EventDef | null = null
    /** 出身事件进行中：结束后回到 pick_story 的奖励轮，而不是推进到下一节点。 */
    private _pendingOrigin = false

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
            tournamentData: undefined,
            rewardBudget: { pointsGiven: 0 },
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
                if (this._eventDef?.id === 'pick_story') {
                    // 选择出身：记录故事 → 叠加地图 → 进入该故事的出身事件
                    const picked = this._storyByOriginEvent(choice.id)
                    if (picked) {
                        this._state.build.story = picked.id
                        this._applyStoryOverlay()
                        if (picked.onNode) picked.onNode(this._state, this._state.nodeIndex)
                        this._pendingOrigin = true
                    }
                }
                this._startEvent(choice.id)
                break
            case 'weapon':
                if (choice.id === 'bare_hands') {
                    // 赤手空拳：不给武器（默认即空手），改为 +4 修炼点
                    // 已达 16 次修炼点上限时不再加点（选空手不突破预算）
                    if (this._state.rewardBudget.pointsGiven < MAX_POINTS_REWARDS) {
                        this._state.unspentPoints += CULT_REWARD.points
                        this._state.rewardBudget.pointsGiven++
                        this._state.nodeLog.push('赤手空拳：+4 修炼点')
                    } else {
                        this._state.nodeLog.push('赤手空拳（修炼已到瓶颈）')
                    }
                    this._state.build.rewards.push({
                        id: 'bare_hands',
                        name: '赤手空拳',
                        type: 'weapon',
                        description: '',
                        tags: [],
                    })
                } else {
                    this._grantReward(choice.id, choice.type)
                }
                this._advanceRound()
                break
            case 'action':
            case 'passive':
            case 'artifact':
                this._grantReward(choice.id, choice.type)
                this._advanceRound()
                break
            case 'points':
                if (this._state.rewardBudget.pointsGiven < MAX_POINTS_REWARDS) {
                    this._state.unspentPoints += CULT_REWARD.points
                    this._state.rewardBudget.pointsGiven++
                    this._state.nodeLog.push(CULT_REWARD.log)
                } else {
                    // 硬上限：已达 16 次修炼点，本次不给点
                    this._state.nodeLog.push('已达修炼点上限')
                }
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
        // 斗炁大会事件：先处理赛程再启动事件
        let tournamentEnemyId: string | undefined
        if (TOURNAMENT_EVENT_IDS.has(eventId)) {
            const bossId = this._state.flags['tournament_final_boss'] as string | undefined
            const result = processTournament(this._state.tournamentData, eventId, bossId)
            this._state.tournamentData = result.tournamentData
            if (result.eliminated) {
                this._state.finished = true
                return
            }
            tournamentEnemyId = result.opponentId
        }

        const ev = getEvent(eventId)
        if (!ev) {
            this._finishEvent()
            return
        }

        this._eventDef = ev
        this._state.roundIdx = 0

        if (ev.rounds && ev.rounds.length > 0) {
            const round = { ...ev.rounds[0], choices: [...ev.rounds[0].choices] }
            if (tournamentEnemyId) round.enemyId = tournamentEnemyId
            this._pushRound(round)
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
        if (copy.enemyId) {
            this._executeCombat(copy)
        }
        this._state.rounds.push(copy)
    }

    private _fillRewardChoices(round: Round): void {
        const ev = this._eventDef
        if (!ev) return

        // pick_story: 从 STORIES 随机抽 3 个，选项即各故事 overrides[1] 的出身事件
        if (ev.id === 'pick_story') {
            if (round.id === 'pick') {
                const stories = pickRandom(STORIES, 3)
                round.choices = stories.map((s) => {
                    const originId = s.overrides[1]
                    const originEv = originId ? getEvent(originId) : undefined
                    return {
                        id: originId ?? s.id,
                        type: 'event' as const,
                        label: originEv?.name ?? s.name,
                        description: originEv?.description,
                    }
                })
                return
            }
            if (round.id === 'reward_show') {
                const story = getStory(this._state.build.story)
                round.choices = []
                if (story?.reward) {
                    const rewardName =
                        story.reward.type === 'points'
                            ? CULT_REWARD.label
                            : getRewardName(story.reward.type, story.reward.id)
                    round.choices.push({
                        id: story.reward.id,
                        type: story.reward.type,
                        label: rewardName,
                    })
                }
                return
            }
            return
        }

        // 其他: 从奖励池生成
        const exclude = this._state.build.rewards.map((r) => (typeof r === 'string' ? r : r.id))
        const playerTags = this._derivePlayerTags()

        // 动态修炼点配额：按「还需 / 剩余机会」决定本轮给修炼点还是实体奖励。
        // 落后就多出修炼点、给多了就少出；快来不及达到 16 次时强制给修炼点（不给 3 选 1）。
        const budgetType = resolveQuotaRewardType(
            this._state.nodeIndex,
            this._state.rewardBudget.pointsGiven,
            ev.rewardType,
            countRewardOpportunities(this._state.nodes, this._state.nodeIndex),
        )
        if (budgetType === 'none') {
            round.choices = [{ id: END_EVENT, type: 'continue', label: '继续' }]
            return
        }

        round.choices = generateRewardChoices(budgetType, playerTags, (r) => {
            if (exclude.includes(r.id)) return false
            // 招式 requiredTags 过滤
            if (r.requiredTags && r.requiredTags.length > 0) {
                if (!r.requiredTags.some((t) => playerTags.includes(t))) return false
            }
            // 事件级 rewardFilter
            if (ev.rewardFilter && !ev.rewardFilter(r)) return false
            // 轮次级 rewardFilter
            if (round.rewardFilter && !round.rewardFilter(r)) return false
            return true
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

    /** 从已有奖励 + 已装备武器推导玩家 tags */
    private _derivePlayerTags(): Tag[] {
        const tags = new Set<Tag>()
        for (const r of this._state.build.rewards) {
            const pool = rewardPool.getPool(r.type as RewardType)
            const def = pool.find((d) => d.id === r.id)
            if (def?.tags) def.tags.forEach((t) => tags.add(t))
        }
        // 已装备的主/副手武器 tags 也纳入（赤手空拳走 points 路径时不在 rewards 中，靠这里补上）
        const allWeapons = [...WEAPON_DB, ...STARTING_WEAPONS]
        for (const wId of [this._state.build.weapon, this._state.build.offhand].filter(Boolean)) {
            const def = allWeapons.find((w) => w.id === wId)
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
            if (this._eventDef?.id === 'dual_wield_training') {
                this._state.build.offhand = entityId
            } else {
                this._state.build.weapon = entityId
            }
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
        // 出身事件结束：回到 pick_story 的奖励轮（结算开局奖励），再进入下一节点
        if (this._pendingOrigin) {
            this._pendingOrigin = false
            this._eventDef = getEvent('pick_story') ?? this._eventDef
            if (this._eventDef && this._eventDef.rounds.length > 1) {
                this._state.roundIdx = 1
                this._pushRound(this._eventDef.rounds[1])
                return
            }
        }
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
        // 层叠顺序：骨架 → 斗炁大会层 → 故事覆写/插入 → 支线填充
        applyTournamentLayer(this._state.nodes)
        applyStoryOverlay(this._state.nodes, this._state.build.story ?? '')
        fillEmptyNodes(this._state.nodes, this._state)
    }

    /** 按出身事件 ID 找对应的故事线（n1 选择出身时用，出身事件定义在故事 overrides[1]）。 */
    private _storyByOriginEvent(eventId: string): StoryDef | undefined {
        return STORIES.find((s) => s.overrides[1] === eventId)
    }
}

/** 开局奖励（story.reward）的显示名。奇物/功法可能带 inherent 标签，不在普通奖励池中，需直接查数据源。 */
function getRewardName(type: RewardType, id: string): string {
    if (type === 'artifact') return getArtifact(id)?.name ?? id
    if (type === 'passive') return getPassive(id)?.name ?? id
    const pool = rewardPool.getPool(type)
    return pool.find((d) => d.id === id)?.name ?? id
}
