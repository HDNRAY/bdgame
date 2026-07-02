import type { CharacterBuild } from '../../entities/character-build'

// ════════════════════════════════════════
//  常量
// ════════════════════════════════════════

/** continue 类型 choice 的 id 为此值时，引擎结束当前事件，推进到下一节点。 */
export const END_EVENT = '__end__'

// ════════════════════════════════════════
//  Node — 地图上的一个位置
// ════════════════════════════════════════

export interface Node {
  /** 本节点绑定的事件 ID 列表。
   *
   *  - undefined / [] : 无固定事件，从事件池随机抽 3 个，生成「选择事件」轮。
   *  - ['xxx']        : 固定 1 个事件，跳过选事件轮，直接开始。
   *  - ['a','b','c']  : 固定 3 个事件。
   *
   *  骨架层 + 故事叠加层决定，叠加后锁定。 */
  eventIds?: string[]
}

// ════════════════════════════════════════
//  Choice — 玩家在某轮中可以点的一个选项
// ════════════════════════════════════════

export interface Choice {
  /** 选项标识。
   *
   *  含义取决于 type：
   *  - event            : 事件 ID，引擎开始该事件。
   *  - weapon/action/passive/artifact : 实体 ID，引擎给奖励。
   *  - continue         : 目标轮次 ID，引擎跳转。值为 END_EVENT 时结束事件。
   *  - points/heal      : 固定为 'points' / 'heal'。 */
  id: string

  /** 选项类型。引擎据此决定处理逻辑。
   *
   *  - 'event'     : 从 3 个事件中挑一个执行。
   *  - 'weapon'    : 给武器奖励，结束事件，推进到下一节点。
   *  - 'action'    : 给招式奖励，结束事件，推进到下一节点。
   *  - 'passive'   : 给功法奖励，结束事件，推进到下一节点。
   *  - 'artifact'  : 给奇物奖励，结束事件，推进到下一节点。
   *  - 'points'    : 加修炼点，结束事件，推进到下一节点。
   *  - 'heal'      : 恢复伤势，结束事件，推进到下一节点。
   *  - 'continue'  : 推进到 id 对应轮次。id === END_EVENT 时结束事件。 */
  type: 'event' | 'weapon' | 'action' | 'passive' | 'artifact' | 'points' | 'heal' | 'continue'

  /** 展示文字。纯文本，不含 emoji。 */
  label: string

  /** 补充说明。选填。 */
  description?: string

  /** 选择后要设置的旗标。逐条合并到 GameState.flags。
   *  示例：{ helped_stranger: true } */
  setFlags?: Record<string, boolean>
}

// ════════════════════════════════════════
//  Round — 一轮交互
//  一个节点包含多轮（选事件 → 战斗 → 奖励选择）。
//  引擎推进后追加到 state.rounds 末尾。
//  推进到下一节点时 rounds 清空，新节点重新累计。
// ════════════════════════════════════════

export interface Round {
  /** 轮次 ID。在同一事件的轮次范围内唯一。
   *
   *  continue 选择用此值做跳转目标。
   *  引擎自动生成格式 'round_0'，自定义轮次可用 'help_stranger'。 */
  id: string

  /** 本轮类型。
   *
   *  'narrative' : 剧情展示。description 为剧情文本，choices 为 continue。
   *  'combat'    : 战斗轮。引擎执行战斗，结果写入 description，
   *                 injuryGained 记录伤势，choices 为 continue。
   *  'reward'    : 奖励选择轮。引擎根据 rewardType 生成多个选项。 */
  type: 'narrative' | 'combat' | 'reward'

  /** 本轮标题。
   *  narrative → "祖祠" / "酒馆"
   *  combat    → "战斗" / "首领战"
   *  reward    → "战利品" / "选择奖励" */
  title: string

  /** 本轮说明文本。narrative→剧情, combat→战斗结果, reward→奖励提示。 */
  description?: string

  /** 上一个选择的结果文本。显示在轮次顶部。选填。 */
  result?: string

  /** 本轮的选项。至少 1 项。
   *  narrative/combat → continue 指向下一轮
   *  reward           → 实体奖励选项
   *  节点选事件轮     → event 类型选项 */
  choices: Choice[]

  /** 敌人 ID（combat 轮）。引擎据其加载敌人。 */
  enemyId?: string

  /** Boss 剧情名（boss combat 轮）。覆盖敌人默认名字。 */
  bossName?: string

  /** 战败导致的伤势增加量（combat 轮）。引擎已同步更新到 injury。 */
  injuryGained?: number
}

// ════════════════════════════════════════
//  EventDef — 事件定义
//  引擎按 ID 引用事件数据。事件决定如何生成轮次。
// ════════════════════════════════════════

export interface EventDef {
  id: string
  name: string
  description?: string
  /** 奖励类型：weapon | action | passive | artifact | points | heal */
  rewardType: string

  /** 自定义轮次序列。
   *
   *  undefined : 引擎根据 rewardType 自动生成轮次。
   *
   *  有值      : 引擎按此数组执行。choices 指向数组中其他轮的 id 实现分支。
   *              continue choice 的 id 为 END_EVENT 时事件结束。
   *
   *  用途：
   *  - 交互事件（酒馆：叙事→选择→叙事→选择→END_EVENT）
   *  - 故事固定事件（xuanmen_weapon：直接展示 3 把武器） */
  rounds?: Round[]
}

// ════════════════════════════════════════
//  GameState — 引擎状态快照
//  每次 selectChoice 后引擎生成新快照并通过 subscribe 推送。外部只读。
// ════════════════════════════════════════

export interface GameState {
  /** 当前节点编号。1-based，1-33。>33 时 finished=true。 */
  nodeIndex: number

  /** 完整地图 33 个节点。叠加后锁定。 */
  nodes: Node[]

  /** 当前节点的所有轮次。推进到下一节点时清空，重新累计。 */
  rounds: Round[]

  /** 角色数据。复用 CharacterBuild。 */
  build: CharacterBuild

  /** 未分配的修炼点。 */
  unspentPoints: number

  /** 伤势 0-100。>=100 时 finished=true。 */
  injury: number

  /** 运行时旗标。由 Choice.setFlags 设置。 */
  flags: Record<string, boolean>

  /** 已完成节点的简要日志。示例：["玄门→飞剑", "战斗→胜利 45/100"] */
  nodeLog: string[]

  /** 是否已结束。 */
  finished: boolean
}

// ════════════════════════════════════════
//  StoryDef — 故事定义
//  玩家在 node 1 选完背景后，故事将 overrides 和 insertions 叠加到地图上。
// ════════════════════════════════════════

export interface EventInsertion {
  eventId: string
  /** 插入范围 [min, max]（1-based，含两端）。叠加时随机选一个位置。 */
  range: [number, number]
}

export interface StoryDef {
  id: string
  name: string
  characterName?: string
  description?: string
  /** { 节点编号: 事件ID | 事件ID[] }。覆盖 eventIds。 */
  overrides?: Record<number, string | string[]>
  /** 随机插入列表。叠加时一次性定死。 */
  insertions?: EventInsertion[]
}

// ════════════════════════════════════════
//  RogueliteEngine — 引擎接口
//  输入输出分离：subscribe 接收状态变更，selectChoice 发起操作。
// ════════════════════════════════════════

export interface RogueliteEngine {
  /** 订阅状态变更。每次 selectChoice 后推送最新 GameState。返回取消订阅函数。 */
  subscribe(listener: (state: GameState) => void): () => void

  /** 玩家做出选择。
   *  @param choiceIndex - 当前最新一轮的第几个选项（0-based）。
   *
   *  引擎流程：
   *    1. 读取最新轮的 choices[choiceIndex]
   *    2. 合并 setFlags 到 flags
   *    3. 根据 type 执行：
   *       - event   : 开始所选事件（追加首轮）
   *       - weapon/action/passive/artifact : 给奖励，写入 nodeLog，清空 rounds，推进
   *       - points  : 加修炼点，同上
   *       - heal    : 恢复伤势，同上
   *       - continue: id === END_EVENT → 结束事件，同上
   *                    id 有效 → 查找并追加对应轮次
   *    4. 推送新 GameState */
  selectChoice(choiceIndex: number): void

  /** 获取当前状态快照。 */
  getState(): GameState
}
