import { generateMap, generateOptions, shuffle, pickRandom, getNodeChoices, ALL_OPPONENT_IDS } from './node-gen'
import { rewardPool } from './reward-pool'
import { runBattle } from '../battle-runner'
import { Character } from '../entities/character'
import { getWeapon } from '../data/weapons'
import { getStory } from '../data/stories/index'
import { getOpponentDef } from '../data/opponents/index'
import type { MapNode, ChoiceResult, RunState, NodeLogEntry, SaveData } from '../entities/node-map'
import type { CharacterBuild } from '../entities/character-build'
import type { Reward } from '../entities/reward'
import type { Tag } from '../entities/tag'
import type { NodeChoice } from './node-gen'

type GameMode = 'quick' | 'normal'

/**
 * 一局游戏的完整状态管理。
 *
 * 快速模式 (quick): 自动/胜率战斗，快速走完33节点。
 * 普通模式 (normal): 手动每回合选招（暂未实现）。
 */
export class GameRun {
    readonly mode: GameMode
    map: MapNode[]
    state: RunState
    private _nodeIdx = 0
    private _enemyPool: string[] = []
    private _enemyIdx = 0
    private _currentChoices: NodeChoice[] = []

    constructor(mode: GameMode = 'quick') {
        this.mode = mode
        this.map = generateMap()
        this.state = {
            map: this.map,
            currentNode: 1,
            build: {
                id: 'player',
                name: '挑战者',
                story: '',
                weapon: '',
                baseAttrs: { strength: 3, vitality: 3, agility: 3, dexterity: 3, insight: 3, wisdom: 3 },
                rewards: [],
            },
            unspentCultPoints: 4,
            defeatedEnemies: [],
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

    /** 当前节点的选择项（所有节点类型统一） */
    getSelectionItems(): NodeChoice[] {
        this._currentChoices = this._generateChoices()
        return this._currentChoices
    }

    // ── 操作 ──

    /** 选了第 index 个选项 */
    selectOption(index: number): ChoiceResult {
        const node = this.getCurrentNode()
        const entry: NodeLogEntry = { nodeIndex: node.index, nodeType: node.type }

        if (node.type === 'bg') return this._selectBg(index, entry)
        if (node.type === 'weapon') return this._selectWeapon(index, entry)
        if (node.type === 'boss') return this._selectBoss(node, entry)
        if (node.forceRewardType) return this._selectForceReward(node, index, entry)

        return this._selectNormal(node, index, entry)
    }

    /** 选了具体奖励（selectOption 返回 rewardChoices 后调用） */
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

    /** 获取对手 build（用于外部指挥战斗） */
    getEnemyBuild(enemyId: string, n: number): CharacterBuild {
        const def = getOpponentDef(enemyId)
        return def ? def.generate(n) : this._fallbackBuild()
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

    // ── 存档 ──

    toJSON(): SaveData {
        return {
            mode: this.mode,
            map: this.map,
            state: this.state,
            nodeIdx: this._nodeIdx,
            enemyPool: this._enemyPool,
            enemyIdx: this._enemyIdx,
        }
    }

    static fromJSON(data: SaveData): GameRun {
        const run = new GameRun(data.mode)
        run.map = data.map
        run.state = data.state
        run._nodeIdx = data.nodeIdx
        run._enemyPool = data.enemyPool
        run._enemyIdx = data.enemyIdx
        return run
    }

    // ── 内部 ──

    /** 委托 node-gen 生成当前节点的选择项 */
    private _generateChoices(): NodeChoice[] {
        const node = this.getCurrentNode()
        const story = getStory(this.state.build.story)
        const override = story?.getNodeOverride?.(node.index)

        // normal 节点需要先生成选项
        if (node.type === 'normal' && !node.forceRewardType) {
            const enemies = this._nextEnemies()
            node.options = generateOptions(node, enemies)
        }

        return getNodeChoices(node, this.ownedRewardIds, this.playerTags, this.state.build.story, override?.choices)
    }

    private _advance(): void {
        this._nodeIdx++
        this.state.currentNode = this.map[this._nodeIdx]?.index ?? 33
        // 故事钩子：额外修炼点
        const story = getStory(this.state.build.story)
        const cultPts = story?.getNodeOverride?.(this.state.currentNode)?.cultPoints
        if (cultPts) this.state.unspentCultPoints += cultPts
        if (this._nodeIdx >= this.map.length) this.state.finished = true
    }

    private _nextEnemies(): string[] {
        const enemies = this._enemyPool.slice(this._enemyIdx, this._enemyIdx + 3)
        this._enemyIdx += enemies.length
        return enemies.length > 0 ? enemies : ['zhangsan']
    }

    private _selectBg(index: number, entry: NodeLogEntry): ChoiceResult {
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

    private _selectWeapon(index: number, entry: NodeLogEntry): ChoiceResult {
        const picked = this._currentChoices[Math.min(index, this._currentChoices.length - 1)]
        this.state.build.weapon = picked.id
        this.state.log.push(entry)
        this._advance()
        return {}
    }

    private _selectBoss(node: MapNode, entry: NodeLogEntry): ChoiceResult {
        const bossId = node.bossId!
        const { winner } = runBattle(
            new Character(this.state.build),
            new Character(this.getEnemyBuild(bossId, node.index)),
        )
        entry.battleResult = winner === 'a' ? 'win' : 'lose'
        entry.enemyId = bossId
        this.state.log.push(entry)
        if (winner === 'a') this.state.defeatedEnemies.push(bossId)
        this.state.finished = true
        return { battleResult: entry.battleResult, enemyId: bossId }
    }

    private _selectForceReward(node: MapNode, index: number, entry: NodeLogEntry): ChoiceResult {
        const picked = this._currentChoices[Math.min(index, this._currentChoices.length - 1)]
        const fType = node.forceRewardType
        if (picked && fType && fType !== 'cult') {
            const pool = rewardPool.getPool(fType)
            const reward = pool.find((r) => r.id === picked.id)
            if (reward) {
                this.state.build.rewards.push(reward)
                entry.chosenReward = reward
            }
        }
        this.state.log.push(entry)
        this._advance()
        return {}
    }

    private _selectNormal(node: MapNode, index: number, entry: NodeLogEntry): ChoiceResult {
        const opts = node.options ?? []
        const opt = opts[Math.min(index, opts.length - 1)]
        if (!opt) {
            this._advance()
            return {}
        }

        entry.chosenOption = opt
        entry.enemyId = opt.enemyId
        const result: ChoiceResult = { eventText: opt.eventText }

        // 战斗
        if (opt.content === 'combat' && opt.enemyId) {
            const { winner } = runBattle(
                new Character(this.state.build),
                new Character(this.getEnemyBuild(opt.enemyId, node.index)),
            )
            entry.battleResult = winner === 'a' ? 'win' : 'lose'
            result.battleResult = entry.battleResult
            result.enemyId = opt.enemyId
            if (winner === 'a') this.state.defeatedEnemies.push(opt.enemyId)
        }

        // 奖励
        if (opt.rewardType === 'cult') {
            this.state.unspentCultPoints += 4
            entry.cultPointsGained = 4
            result.cultPoints = 4
        } else {
            result.rewardChoices = this._pickReward(opt.rewardType)
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
        return getOpponentDef(pickRandom(ALL_OPPONENT_IDS, 1)[0])!.generate(1)
    }
}
