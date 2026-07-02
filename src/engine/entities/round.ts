// ════════════════════════════════════════
//  常量
// ════════════════════════════════════════

/** continue 类型 choice 的 id 为此值时，引擎结束当前事件，推进到下一节点。 */
export const END_EVENT = '__end__'

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

    /** 选择后要设置的旗标。逐条合并到 GameState.flags。示例：{ helped_stranger: true }。 */
    setFlags?: Record<string, boolean>
}

// ════════════════════════════════════════
//  Round — 一轮交互
//  一个节点包含多轮（选事件 → 战斗 → 奖励选择）。
//  引擎推进后追加到 state.rounds 末尾。推进到下一节点时 rounds 清空，新节点重新累计。
// ════════════════════════════════════════

export interface Round {
    /** 轮次 ID。在同一事件的轮次范围内唯一。
     *  continue 选择用此值做跳转目标。引擎自动生成格式 'round_0'，自定义轮次可用 'help_stranger'。 */
    id: string

    /** 本轮类型。
     *  'narrative' : 剧情展示。description 为剧情文本，choices 为 continue。
     *  'combat'    : 战斗轮。引擎执行战斗，结果写入 description，injuryGained 记录伤势。
     *  'reward'    : 奖励选择轮。引擎根据 rewardType 生成多个选项。 */
    type: 'narrative' | 'combat' | 'reward'

    /** 本轮标题。narrative→"祖祠", combat→"战斗", reward→"战利品"。 */
    title: string

    /** 本轮说明文本。narrative→剧情, combat→战斗结果, reward→奖励提示。 */
    description?: string

    /** 上一个选择的结果文本。显示在轮次顶部。选填。 */
    result?: string

    /** 本轮的选项。至少 1 项。narrative/combat→continue, reward→实体选项。 */
    choices: Choice[]

    /** 敌人 ID（combat 轮）。引擎据其加载敌人。 */
    enemyId?: string

    /** Boss 剧情名（boss combat 轮）。覆盖敌人默认名字。 */
    bossName?: string

    /** 战败导致的伤势增加量（combat 轮）。引擎已同步更新到 injury。 */
    injuryGained?: number
}
