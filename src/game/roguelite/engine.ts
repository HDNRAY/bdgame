import { STORIES } from '../../data/stories/index'
import { getEvent, ALL_EVENTS } from '../../data/events/index'
import { buildNodeSpecs, resolveNode } from './map-builder'
import {
    processTournament,
    recordPlayerMatchResult,
    isTournamentEliminated,
    TOURNAMENT_EVENT_IDS,
} from '../tournament/integration'
import { CULT_REWARD, MAX_POINTS_REWARDS } from '../entities/reward'
import { rewardPool } from './reward-pool'
import { pickRandom, resolveQuotaRewardType, countRewardOpportunities, injuryForNode } from './util'
import { championBuildFromSave } from '../champion-boss'
import { hasCleared, recordBossResult, recordClear } from '../meta-save'
import { WEAPON_DB } from '../../data/weapons/weapons'
import { STARTING_WEAPONS } from '../../data/weapons/starting-weapons'
import { END_EVENT, type Round, type Choice } from '../../game/entities/round'
import { applyEffects, type Effect, type EffectContext } from '../../game/entities/effect'
import { evaluateWhen } from '../../game/entities/condition'
import type { RewardSpec } from '../../game/entities/reward-spec'
import type { GameState, RogueliteEngine } from '../../engine/entities/engine'
import type { RewardType, RewardEntity } from '../../game/entities/reward'
import type { EventDef } from '../../game/entities/event'
import type { StoryDef } from '../../game/entities/story'
import type { CharacterBuild } from '../../game/entities/character-build'
import type { Tag } from '../../engine/entities/tag'
import { Character } from '../../engine/entities/character'
import { classifyAttackStyle } from '../../engine/ai/planner'
import { gen, getOpponentDef, pickRandomOpponentId } from '../../data/opponents/index'
import { runBattle } from '../../engine/battle-runner'
import type { BattleStatsSnapshot } from '../../engine/combat/battle-stats'

export class RogueliteRun implements RogueliteEngine {
    private _listeners = new Set<(state: GameState) => void>()
    private _state: GameState
    private _eventDef: EventDef | null = null
    /** 上一场战斗结果（胜负分支：下一轮次可读 result.won） */
    private _lastCombatResult: { won: boolean } | undefined = undefined
    /** 结局是否已写进元进度（一场只写一次） */
    private _endingRecorded = false
    /** 最近一场战斗回放原始日志（不进 state，避免每次 structuredClone 复制大数组；UI 播放用） */
    private _battleReplay:
        | { roundId: string; entries: { event: unknown; timelineMs: number }[]; stats?: BattleStatsSnapshot }
        | undefined =
        undefined
    /** 大会对手（processTournament 产出）：注入到 id 为 match/group_r0 的战斗轮 */
    private _pendingTournamentEnemy: string | undefined = undefined

    constructor() {
        this._state = {
            nodeIndex: 1,
            roundIdx: 0,
            nodes: buildNodeSpecs(ALL_EVENTS),
            rounds: [],
            history: [],
            build: this._defaultBuild(),
            unspentPoints: 0,
            injury: 0,
            flags: {},
            nodeLog: [],
            tournamentData: undefined,
            finished: false,
        }
        this._state.flags['cleared_before'] = hasCleared()
        this._syncInjuryFlag()
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
        // 记下本轮选了什么（历史回看时只展示选中项）
        round.chosen = { id: choice.id, label: choice.label ?? choice.id }
        // 一切副作用统一走 choice.effects（写 flag / 给奖励 / 加点…）
        this._applyEffects(choice.effects)

        switch (choice.type) {
            case 'event':
                if (this._eventDef?.id === 'pick_story') {
                    // 出身选择：同步 build.story/name（出身事件由 choice.effects 里 setMany({story}) 激活）
                    const picked = this._storyByOriginEvent(choice.id)
                    if (picked) {
                        this._state.build.story = picked.id
                        this._state.build.name = picked.characterName ?? this._state.build.name
                    }
                }
                this._startEvent(choice.id)
                break
            case 'weapon':
                this._grantReward(choice.id, 'weapon', choice.slot)
                this._advanceRound()
                break
            case 'action':
            case 'passive':
            case 'artifact':
                this._grantReward(choice.id, choice.type)
                this._advanceRound()
                break
            case 'points':
                this._grantPoints(4)
                this._advanceRound()
                break
            case 'continue':
                if (choice.id === END_EVENT) {
                    this._finishEvent()
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

    /** 指定轮次的战斗回放原始日志（若该轮为最近一场战斗/教学）。 */
    getBattleReplay(
        roundId: string,
    ): { entries: { event: unknown; timelineMs: number }[]; stats?: BattleStatsSnapshot } | undefined {
        return this._battleReplay?.roundId === roundId ? this._battleReplay : undefined
    }

    /** 更新角色数据（备战保存时调用）。 */
    updateBuild(build: CharacterBuild, remainingPoints?: number): void {
        this._state.build = build
        if (remainingPoints !== undefined) {
            this._state.unspentPoints = remainingPoints
        }
        this._emit()
    }

    // ── 内部：状态读取 ──

    private _defaultBuild(): CharacterBuild {
        return {
            id: 'player',
            name: '小蝌蚪',
            story: '',
            weapon: 'bare_hands',
            // battleStyle 显式必填（不再随武器自动判定）；开局空手默认贴身
            battleStyle: 'clinch',
            baseAttrs: { strength: 3, vitality: 3, agility: 3, dexterity: 3, insight: 3, wisdom: 3 },
            rewards: [],
            actionConfigs: [],
        }
    }

    private _pointsGiven(): number {
        return Number(this._state.flags['points_granted'] ?? 0)
    }

    private _effectCtx(): EffectContext {
        return {
            flags: this._state.flags,
            build: this._state.build,
            unspentPoints: this._state.unspentPoints,
            injury: this._state.injury,
            nodeLog: this._state.nodeLog,
        }
    }

    private _applyEffects(effects: Effect[] | undefined): void {
        const ctx = this._effectCtx()
        applyEffects(ctx, effects)
        // build/flags/nodeLog 是引用，直接生效；原始值同步回状态
        this._state.unspentPoints = ctx.unspentPoints
        this._state.injury = ctx.injury
        this._syncInjuryFlag()
    }

    /** 伤势同步为 flag（when 条件唯一数据源是 flags，医馆等按伤势门控的事件读它） */
    private _syncInjuryFlag(): void {
        this._state.flags['injury'] = this._state.injury
    }

    private _grantPoints(n: number): void {
        if (this._pointsGiven() < MAX_POINTS_REWARDS) {
            this._state.unspentPoints += n
            this._state.flags['points_granted'] = this._pointsGiven() + 1
            this._state.nodeLog.push(CULT_REWARD.log)
        } else {
            this._state.nodeLog.push('已达修炼点上限')
        }
    }

    // ── 内部：节点进入（渐进生成 · 懒解析） ──

    private _enterNode(): void {
        // 归档上一个节点的回合（历史只留卡片与结果，不留回放）
        if (this._state.rounds.length > 0) this._state.history.push(...this._state.rounds)
        this._state.rounds = []
        this._eventDef = null
        this._state.roundIdx = 0

        const resolution = resolveNode(this._state.nodes[this._state.nodeIndex - 1], this._state.flags, (id) => {
            const ev = getEvent(id)
            return { label: ev?.name ?? id, description: ev?.description }
        })
        if (resolution.mode === 'direct') {
            this._startEvent(resolution.eventId)
        } else if (resolution.mode === 'choice') {
            this._state.rounds.push({
                id: 'pick_path',
                title: '又是阳光明媚的一天',
                description: '你决定去-',
                choices: resolution.options.map((o) => ({
                    id: o.eventId,
                    type: 'event' as const,
                    label: o.label,
                    description: this._hintFor(o.eventId, o.description),
                })),
            })
        } else {
            console.error(`Node ${this._state.nodeIndex} 没有可用候选`)
            this._finishEvent()
        }
    }

    /** 池选项提示：按事件是否含战斗 / 奖励类型，在描述里追加「（将进行战斗）」「（+修炼点）」等标记 */
    private _hintFor(eventId: string, base?: string): string {
        const ev = getEvent(eventId)
        const hints: string[] = []
        if (ev?.rounds.some((r) => r.enemyId || r.enemyPool || r.enemyFromSave)) hints.push('将进行战斗')
        const kind = ev?.reward?.kind
        if (kind === 'points') hints.push('+修炼点')
        else if (kind === 'item') hints.push('奖励功法/招式')
        const suffix = hints.length > 0 ? `（${hints.join(' · ')}）` : ''
        return base ? `${base}${suffix}` : suffix || '继续'
    }

    // ── 内部：开始事件 ──

    private _startEvent(eventId: string): void {
        // 斗炁大会事件：先处理赛程再启动事件
        // 对手注入改为挂起，_pushRound 遇到 id 为 match/group_r0 的战斗轮时注入
        // （n23 开幕有热身赛：小组赛 r0 在热身后打，不能被注入到开幕剧情轮）
        this._pendingTournamentEnemy = undefined
        if (TOURNAMENT_EVENT_IDS.has(eventId)) {
            const bossId = this._state.flags['tournament_final_boss'] as string | undefined
            const result = processTournament(this._state.tournamentData, eventId, bossId)
            this._state.tournamentData = result.tournamentData
            if (result.eliminated) {
                this._state.finished = true
                return
            }
            this._pendingTournamentEnemy = result.opponentId
        }

        const ev = getEvent(eventId)
        if (!ev) {
            this._finishEvent()
            return
        }

        this._eventDef = ev
        this._state.roundIdx = 0

        // 事件开始即执行效果
        this._applyEffects(ev.effects)

        if (ev.rounds && ev.rounds.length > 0) {
            this._pushRound({ ...ev.rounds[0], choices: [...ev.rounds[0].choices] })
            return
        }

        // 无自定义 rounds → 自动生成奖励轮
        this._state.rounds.push({
            id: 'event_' + ev.id,
            title: ev.name,
            description: ev.description,
            choices: [],
        })
        this._fillRewardChoices(this._state.rounds[this._state.rounds.length - 1])
    }

    // ── 内部：轮次推送 / 奖励填充 ──

    private _pushRound(round: Round): void {
        const copy = { ...round, choices: [...round.choices] }
        // 大会对手注入：遇到 match（各场次）/ group_r0（n23 小组赛 r0）战斗轮时挂入
        if (this._pendingTournamentEnemy && (copy.id === 'match' || copy.id === 'group_r0')) {
            copy.enemyId = this._pendingTournamentEnemy
            this._pendingTournamentEnemy = undefined
        }
        if (round.choices.length === 0 && this._eventDef) {
            this._fillRewardChoices(copy)
        }
        // 条件选项：按当前 flags + 上一场战斗结果过滤（热身赛胜负分支用 result.won）
        const whenCtx = { flags: this._state.flags, result: this._lastCombatResult }
        copy.choices = copy.choices.filter((c) => evaluateWhen(c.when, whenCtx))
        // 隐藏boss：从元进度取「最近一次通关的玩家 build」；首次通关（没有存档）则跳过这一轮
        if (copy.enemyFromSave) {
            const boss = championBuildFromSave()
            if (!boss) {
                this._lastCombatResult = undefined
                // 那具躯体不存在 → 连同隐藏boss 序列的后续轮次一起跳过（guardian_result / beaten）
                const rounds = this._eventDef?.rounds ?? []
                this._state.roundIdx++
                while (this._state.roundIdx < rounds.length && rounds[this._state.roundIdx].bossOnly) {
                    this._state.roundIdx++
                }
                if (this._state.roundIdx < rounds.length) this._pushRound(rounds[this._state.roundIdx])
                else this._finishEvent()
                return
            }
            copy.enemyBuild = boss
        }
        const enemyId = copy.enemyId ?? (copy.enemyPool ? pickRandomOpponentId(copy.enemyPool) : undefined)
        if (copy.tutorial) {
            // 教学展示轮：AI vs AI 观战，生成回放（不计胜负/伤势/奖励）
            const t = copy.tutorial
            const aDef = getOpponentDef(t.aId)
            const bDef = getOpponentDef(t.bId)
            if (aDef && bDef) {
                const a = new Character(gen(aDef, t.level ?? 33))
                const b = new Character(gen(bDef, t.level ?? 33))
                const { engine } = runBattle(a, b, undefined, 4, false, { statsLevel: 2 })
                this._battleReplay = {
                    roundId: copy.id,
                    entries: engine.state.log.getAll(),
                    stats: engine.stats?.snapshot(),
                }
            }
            delete copy.enemyId
            delete copy.enemyPool
            copy.choices = copy.choices.filter((c) => evaluateWhen(c.when, whenCtx))
            this._state.rounds.push(copy)
            this._lastCombatResult = undefined
            return
        }
        if (enemyId || copy.enemyBuild) {
            copy.enemyId = enemyId
            this._executeCombat(copy)
            this._lastCombatResult = { won: copy.result?.won ?? false }
        } else {
            this._lastCombatResult = undefined
        }
        // rewardFilter 是函数，只在填奖励时用；存进 state 后 structuredClone 无法克隆函数
        delete copy.rewardFilter
        this._state.rounds.push(copy)
    }

    private _fillRewardChoices(round: Round): void {
        const ev = this._eventDef
        if (!ev) return

        // pick_story：随机抽 3 条故事线，选项即各故事出身事件（effects 激活故事 + 开局奖励）
        if (ev.id === 'pick_story' && round.id === 'pick') {
            const stories = pickRandom(STORIES, 3)
            round.choices = stories.map((s) => {
                const originEv = getEvent(s.originEventId)
                return {
                    id: s.originEventId,
                    type: 'event' as const,
                    label: originEv?.name ?? s.name,
                    description: originEv?.description,
                    effects: s.reward,
                }
            })
            return
        }

        // 奖励规格：轮次级优先
        const spec: RewardSpec | undefined = round.reward ?? ev.reward

        if (!spec || spec.kind === 'none') {
            round.choices = [{ id: END_EVENT, type: 'continue', label: '继续' }]
            return
        }

        // ── 修炼点：唯一选项，不参与"抽 3 条" ──
        // 奖励配额（账本）：整局 29 槽 = 16 次修炼点 + 13 个实体奖励。
        // entityGiven 传实际已发的实体数（n1 开局奇物、n2/n3 兵器招式、n23 定点奖励都在内）。
        // 总数不会超 29：能发奖励的节点固定 28 个（n23 双发 → 29），淘汰赛阶段结构上不发奖励，无需兜底。
        const pointsGiven = this._pointsGiven()
        const quota = resolveQuotaRewardType(
            this._state.nodeIndex,
            pointsGiven,
            countRewardOpportunities(this._state.nodes, this._state.nodeIndex),
            this._state.build.rewards.length,
        )
        if (quota === 'points') {
            round.choices = [
                { id: CULT_REWARD.id, type: 'points', label: CULT_REWARD.label, description: CULT_REWARD.description },
            ]
            return
        }

        // ── 实体奖励：所有节点同一条流程 ──
        // 规格只决定"候选从哪来"：fixed = 显式清单；item = 类型池 + 过滤；points 类事件转实体时默认给功法。
        // 取到候选之后每个节点完全一样：滤掉已拥有 → 随机抽 3 条 → 不足 3 条用同类型普池补足。
        const exclude = this._state.build.rewards.map((r) => (typeof r === 'string' ? r : r.id))
        const poolType: RewardType =
            spec.kind === 'fixed'
                ? ((spec.choices[0]?.type ?? 'weapon') as RewardType)
                : spec.kind === 'points'
                  ? 'passive'
                  : spec.pool
        const candidates =
            spec.kind === 'fixed'
                ? spec.choices.map(
                      (c): Choice => ({
                          id: c.id,
                          type: c.type ?? 'weapon',
                          label: c.label,
                          description: c.description,
                          slot: c.slot,
                      }),
                  )
                : this._itemCandidates(spec, poolType, exclude, this._derivePlayerTags(), round)
        const choices = this._padToThree(
            pickRandom(
                candidates.filter((c) => !exclude.includes(c.id)),
                3,
            ),
            poolType,
            exclude,
            spec.kind === 'item' ? spec.slot : undefined,
        )
        round.choices = choices.length > 0 ? choices : [{ id: END_EVENT, type: 'continue', label: '继续' }]
    }

    /** item 规格的候选清单：类型池 + 规格过滤（ids/includeTags/ap 范围/武器关联/自定义 filter），已拥有的排除。
     *  抽 3 条与不足补足由调用方统一做（见 _padToThree），这里只负责"候选从哪来"。 */
    private _itemCandidates(
        spec: Extract<RewardSpec, { kind: 'item' }> | { kind: 'points' },
        poolType: RewardType,
        exclude: string[],
        playerTags: Tag[],
        round: Round,
    ): Choice[] {
        const source = rewardPool.getPool(poolType)
        // 通用过滤（始终生效）：排除已有/ids/ap范围/招式武器关联/自定义 filter
        const passGeneral = (r: RewardEntity): boolean => {
            if (exclude.includes(r.id)) return false
            if (spec.kind === 'item') {
                if (spec.ids && !spec.ids.includes(r.id)) return false
                if (spec.excludeTags && spec.excludeTags.some((t) => r.tags.includes(t as Tag))) return false
                if (spec.apMin !== undefined && 'apCost' in r && r.apCost < spec.apMin) return false
                if (spec.apMax !== undefined && 'apCost' in r && r.apCost > spec.apMax) return false
                if (spec.noPrePost && (r.tags.includes('pre_action') || r.tags.includes('post_action'))) return false
                if (spec.requireTags && !r.requiredTags?.length) return false
            }
            // 招式 requiredTags ∩ 玩家 tags（武器关联是通用机制）
            if (r.requiredTags && r.requiredTags.length > 0) {
                if (!r.requiredTags.some((t) => playerTags.includes(t))) return false
            }
            if (round.rewardFilter && !round.rewardFilter(r)) return false
            return true
        }
        // 标签过滤：includeTags 优先筛出标签候选；不足 3 个时用普通池补足（学特定类型功法事件如酒功/洞察共用）
        const passTags = (r: RewardEntity): boolean => {
            if (spec.kind !== 'item' || !spec.includeTags) return true
            return spec.includeTags.some((t) => r.tags.includes(t as Tag))
        }

        const general = source.filter(passGeneral)
        const tagged = general.filter(passTags)
        const items = spec.kind === 'item' && spec.includeTags
            ? [...tagged, ...general.filter((r) => !tagged.includes(r))]
            : general.filter(passTags)
        return items.map(
            (i: RewardEntity): Choice => ({
                id: i.id,
                type: poolType,
                label: i.name,
                description: i.description,
                slot: spec.kind === 'item' ? spec.slot : undefined,
            }),
        )
    }

    /** 实体奖励候选收口：不足 3 条时用**同类型普池**补足（已拥有的一律排除）。各节点共用这一处。 */
    private _padToThree(choices: Choice[], type: RewardType, exclude: string[], slot?: 'main' | 'offhand'): Choice[] {
        if (choices.length >= 3) return choices
        const taken = new Set([...exclude, ...choices.map((c) => c.id)])
        const extra = pickRandom(
            rewardPool.getPool(type).filter((r) => !taken.has(r.id)),
            3 - choices.length,
        )
        return [
            ...choices,
            ...extra.map(
                (i: RewardEntity): Choice => ({
                    id: i.id,
                    type,
                    label: i.name,
                    description: i.description,
                    slot,
                }),
            ),
        ]
    }

    /** 执行战斗轮 */
    private _executeCombat(round: Round): void {
        const enemyDef = getOpponentDef(round.enemyId ?? '')
        // 隐藏boss：用存档里的玩家 build（`_pushRound` 已把它注入 round.enemyBuild），不走 gen()
        const src = round.enemyBuild ?? (enemyDef ? gen(enemyDef, this._state.nodeIndex) : undefined)
        if (!src) return
        const isChampionBoss = !!round.enemyBuild

        const player = new Character(this._state.build)
        const enemyBuild = { ...src }
        // Boss 剧情名覆盖（战斗内显示用；属性/招式仍取 enemyId 定义）
        if (round.bossName) enemyBuild.name = round.bossName
        const enemy = new Character(enemyBuild)

        const { winner, engine } = runBattle(player, enemy, undefined, 4, false, { statsLevel: 2 })
        // 保留本场回放日志 + 本场统计（UI 用 initialData 播 log；不进 state，避免每次克隆大数组）
        this._battleReplay = {
            roundId: round.id,
            entries: engine.state.log.getAll(),
            stats: engine.stats?.snapshot(),
        }
        const lost = winner === enemy.id
        const injuryGained = lost ? injuryForNode(this._state.nodeIndex) : 0

        round.result = {
            won: !lost,
            injuryGained,
            log: [],
        }

        this._state.injury += injuryGained
        this._syncInjuryFlag()

        // 斗炁大会：把真实战斗结果写回赛程（决定晋级/出线/夺冠），决赛落败即淘汰
        // 只记录正式场次（match / group_r0）——n23 的热身赛不计胜负
        if (
            this._eventDef &&
            TOURNAMENT_EVENT_IDS.has(this._eventDef.id) &&
            (round.id === 'match' || round.id === 'group_r0') &&
            this._state.tournamentData
        ) {
            this._state.tournamentData = recordPlayerMatchResult(this._state.tournamentData, !lost)
            if (isTournamentEliminated(this._state.tournamentData)) {
                this._state.finished = true
                this._state.rounds = []
            }
        }
        // 隐藏boss 战绩（元进度）
        if (isChampionBoss) recordBossResult(!lost)
    }

    /** 从已有奖励 + 已装备武器推导玩家 tags */
    private _derivePlayerTags(): Tag[] {
        const tags = new Set<Tag>()
        for (const r of this._state.build.rewards) {
            const pool = rewardPool.getPool(r.type as RewardType)
            const def = pool.find((d) => d.id === r.id)
            if (def?.tags) def.tags.forEach((t) => tags.add(t))
        }
        const allWeapons = [...WEAPON_DB, ...STARTING_WEAPONS]
        for (const wId of [this._state.build.weapon, this._state.build.offhand].filter(Boolean)) {
            const def = allWeapons.find((w) => w.id === wId)
            if (def?.tags) def.tags.forEach((t) => tags.add(t))
        }
        return [...tags]
    }

    // ── 内部：给奖励 ──

    private _grantReward(entityId: string, type: RewardType, slot: 'main' | 'offhand' = 'main'): void {
        // 去重：已拥有的奖励不再重复给（热身授艺的功法可能在普通池里已有）
        if (this._state.build.rewards.some((r) => r.id === entityId)) {
            this._state.nodeLog.push(`已拥有 ${entityId}，跳过`)
            return
        }
        this._state.build.rewards.push({
            id: entityId,
            name: entityId,
            type,
            description: '',
            tags: [],
        })
        if (type === 'weapon') {
            if (slot === 'offhand') {
                this._state.build.offhand = entityId
            } else {
                this._state.build.weapon = entityId
                // battleStyle 显式必填：主手换武器后按新武器同步建议风格（与玩家 build 编辑器保存口径一致）
                const allWeapons2 = [...WEAPON_DB, ...STARTING_WEAPONS]
                const newDef = allWeapons2.find((w) => w.id === entityId)
                if (newDef) {
                    this._state.build.battleStyle = classifyAttackStyle(newDef.range)
                }
            }
            // 装备 → flag 同步（武器标签是通用机制，供 when 条件读取）
            const allWeapons = [...WEAPON_DB, ...STARTING_WEAPONS]
            const def = allWeapons.find((w) => w.id === entityId)
            this._state.flags['weapon_one_handed'] = Boolean(
                def?.tags.includes('one_handed') && !def?.tags.includes('imperial'),
            )
            if (slot === 'offhand') this._state.flags['has_offhand'] = true
        }
        this._state.nodeLog.push(`${type}: ${entityId}`)
    }

    // ── 内部：跳转 / 结束 / 推进 ──

    private _advanceRound(): void {
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
            this._recordEndingIfAny()
            this._state.finished = true
            this._state.rounds = []
            return
        }
        this._enterNode()
    }

    /** 结局轮写下的 flag → 元进度存档（通关数 / 结局种类 / 最近一次通关的 build） */
    private _recordEndingIfAny(): void {
        if (this._endingRecorded) return
        const ending = this._state.flags['ending_loop'] ? 'loop' : this._state.flags['ending_true'] ? 'true' : undefined
        if (!ending) return
        this._endingRecorded = true
        recordClear({
            build: this._state.build,
            ending,
            injuries: this._state.injury,
            rewards: this._state.build.rewards.length,
        })
    }

    /** 按出身事件 ID 找对应的故事线（n1 选择出身时用）。 */
    private _storyByOriginEvent(eventId: string): StoryDef | undefined {
        return STORIES.find((s) => s.originEventId === eventId)
    }

    private _emit(): void {
        const s = structuredClone(this._state)
        for (const fn of this._listeners) fn(s)
    }
}
