# 第 7 章：数据表结构与内容

---

## 7.1 世界观：两个正交系统

```
┌──────────────────────────────────────────────┐
│              故事背景 × 10                    │
│  (开局三选一，决定叙事基调 + 专有事件)         │
│  可能关联 0-N 个选手，也可能全不关联          │
└──────────────────────┬───────────────────────┘
                       │ 独立
                       ▼
┌──────────────────────────────────────────────┐
│              32 强选手池                      │
│  (淘汰赛对手，可独立解锁)                     │
│  可能与某些故事背景重叠，也可能完全不相关      │
└──────────────────────────────────────────────┘
```

**关键原则：** 故事背景和 32 强选手是两个独立的数据集，它们通过**解锁系统**交叉关联——击败某选手可能解锁某故事线的事件，反之某个故事线的选择可能解锁某选手的出场资格。

---

## 7.2 流派表 (FightStyle)

### 7.2.1 数据结构

> **注意：** 所有可收集/可装备物品共享 `GameEntity` 基类（`id` + `name` + `description`），
> 见 `src/engine/entities/base.ts`。

```ts
interface FightStyle {
    id: string
    name: string
    description: string
    primary: AttrName
    secondary?: AttrName
    /** 推荐武器 ID（对应 WEAPON_DB） */
    recommendedWeapon: string
    tags: string[]
}
```

> **注意：** 武器系统已从 `WeaponType` 枚举重构为个体物品系统，见 `src/engine/data/weapons.ts`。
> 流派不再绑定武器类别，而是推荐一把具体武器。招式通过标签（劈砍/钝击/戳刺）匹配武器。

### 7.2.2 示例流派

| ID              | 名称     | 主属性    | 次属性    | 推荐武器 | 标签           |
| --------------- | -------- | --------- | --------- | -------- | -------------- |
| `nanoblade`     | 纳米剑术 | technique | dexterity | 待定     | 近战·精准·流血 |
| `phantom`       | 幻象术   | wisdom    | insight   | 待定     | 远程·诡术·欺诈 |
| `broken_katana` | 残心居合 | strength  | technique | 待定     | 近战·爆发·忍耐 |

---

## 7.3 选手表 (OpponentData)

### 7.3.1 数据结构

```ts
interface OpponentData {
    id: string
    name: string
    title: string
    style: string // 引用 FightStyle.id

    baseAttrs: Record<AttrName, number>
    weapon: string // 武器 ID，对应 WEAPON_DB
    signatureMove: string
    extraActions?: string[]
    skills?: string[]
    implants?: string[] // 大赛阶段才装备

    // 叙事
    flavor: string
    personality: string
    quoteWin: string
    quoteLose: string

    // 出场条件（null = 初始就在 32 强池中）
    unlock?: UnlockCondition

    // 特殊规则
    special?: OpponentSpecial
}
```

### 7.3.2 示例选手

#### ① 「剑庐」谢云疏

```ts
{
    id: 'xie_yunshu',
    name: '谢云疏',
    title: '剑庐',
    style: 'nanoblade',

    baseAttrs: { strength: 4, vitality: 5, dexterity: 10, technique: 12, insight: 8, wisdom: 6 },
    weapon: 'nanoblade',
    signatureMove: '一剑万里',
    extraActions: ['横斩', '燕返'],
    skills: ['残心'],

    flavor: '谢氏剑庐末裔。赛博时代没人再用实体剑了，他带着家族最后一把纳米剑参赛。',
    personality: '沉默寡言，开口必然一针见血。',
    quoteWin: '"你的路还很长。"',
    quoteLose: '"……剑没断，是我断了。"',

    unlock: null,  // 初始就在 32 强中

    special: {
        description: '纳米剑可在挥砍瞬间延展半尺。前 3 次攻击距离判定 +1。',
        mechanic: { extendRange: 1, maxExtendedAttacks: 3 },
    },
}
```

#### ② 「蜃楼」鸾夫人

```ts
{
    id: 'luan_furen',
    name: '鸾夫人',
    title: '蜃楼',
    style: 'phantom',

    baseAttrs: { strength: 3, vitality: 4, dexterity: 7, technique: 9, insight: 11, wisdom: 13 },
    weapon: 'control',
    signatureMove: '海市蜃楼',
    extraActions: ['飞针', '弹指'],
    skills: ['缩地成寸'],
    implants: ['幻象芯片'],

    flavor: '前辰星集团总监，发现意识操控实验后被灭口。脑中植入幻象芯片——她反而学会了控制它。',
    personality: '优雅从容，话里有话。',
    quoteWin: '"你看到的我，从来就不是我。"',
    quoteLose: '"……原来你也一样。"',

    unlock: { type: 'story_choice', storyId: 'revenge' },  // 选复仇线才出场

    special: {
        description: '回合开始生成 1-2 个全息分身。攻击分身→硬直(+200ms)，攻击真身→分身全消。',
        mechanic: { maxClones: 3, stunOnWrong: 200, autoGenerateChance: 0.5 },
    },
}
```

#### ③ 「不灭」武藏

```ts
{
    id: 'wuzang',
    name: '武藏',
    title: '不灭',
    style: 'broken_katana',

    baseAttrs: { strength: 12, vitality: 9, dexterity: 8, technique: 10, insight: 7, wisdom: 4 },
    weapon: 'katana',
    signatureMove: '断钢',
    extraActions: ['正拳', '崩拳'],
    skills: ['钢筋铁骨'],

    flavor: '前安保特工，失去同伴和佩刀。断刀封存着同伴的战斗数据。',
    personality: '寡言沉重。对"换把新的"会沉默很久。',
    quoteWin: '"你还不到换刀的时候。"',
    quoteLose: '"……够了。"',

    unlock: { type: 'defeat_opponent', opponentId: 'xie_yunshu' },

    special: {
        description: '断钢太刀 3 次出鞘。拔刀绝对命中+无视招架。每回合未拔刀伤害 +15%。3 次用完太刀断，转徒手。',
        mechanic: { maxDraws: 3, bonusPerTurn: 0.15, unblockable: true, breaksAfter: 3 },
    },
}
```

---

## 7.4 故事背景表 (StoryBackground)

### 7.4.1 与选手的关系

**故事背景 ≠ 选手。** 故事背景是叙事线——可能有专属角色，但这些角色不一定在 32 强中；反之 32 强选手也不一定有任何故事背景提及。

```
关系矩阵：

                      故事背景 A   故事背景 B   故事背景 C   ...  (无关联)
  32 强选手「谢云疏」      ✔                          ✔
  32 强选手「鸾夫人」                  ✔
  32 强选手「武藏」
  故事专属角色「老者」      ✔                         (不在 32 强中)
  故事专属角色「小孩」      ✔          ✔              (不在 32 强中)
```

### 7.4.2 数据结构

```ts
interface StoryBackground {
    id: string
    name: string // 背景名
    tagline: string // 一句话梗概
    description: string // 选择时显示的叙事描述

    // 第一阶段 Boss 由此决定
    phase1Boss: BossDefinition

    // 专属事件池（只有选此背景才会出现的事件）
    exclusiveEvents: string[]

    // 全局权重修正
    weightModifiers?: {
        eventWeights?: Partial<Record<EventType, number>>
        styleBias?: Record<string, number> // styleId → 乘数
        shopBias?: { itemTypes?: string[] }
    }

    // 此背景解锁的内容（选此背景后才可用）
    unlocks?: {
        opponents?: string[]
        artifacts?: string[]
        skills?: string[]
        actions?: string[]
        events?: string[]
    }

    // 解锁条件（null = 开局可选）
    unlock?: UnlockCondition
}
```

### 7.4.3 示例故事背景

```ts
// 示例 1：初始可选
{
    id: 'inner_demon',
    name: '心魔',
    tagline: '你被自己的过去所困扰。',
    description: '每一次出拳，都像在打自己的倒影。你参加的不仅是大赛，更是一场自我了断。',
    phase1Boss: {
        name: '心魔化身',
        flavor: '一个和你长得一模一样的人。你出什么拳，他也出什么拳。',
        style: 'mirror',            // 镜像风格——复制玩家的招式
        baseAttrs: { ... },         // 属性和玩家当前一致
    },
    exclusiveEvents: ['memory_temple', 'mirror_self', 'past_ghost'],
    weightModifiers: {
        eventWeights: { battle: -5, event: +10, forging: +5 },
        styleBias: { phantom: 1.5 },
    },
    unlocks: {
        artifacts: ['memory_shard'],
        events: ['memory_temple', 'mirror_self', 'past_ghost', 'final_acceptance'],
    },
    unlock: null,
}

// 示例 2：需要解锁
{
    id: 'saved_child',
    name: '托孤',
    tagline: '你在街头救了一个孩子。',
    description: '那是个义体过载倒在路边的孩子。你把他送到安全屋，他醒来后叫你"师父"。',
    phase1Boss: {
        name: '街头绑匪',
        flavor: '追捕那个孩子的赛帮打手。他们想要回"货物"。',
        style: 'bounty_hunter',
        baseAttrs: { strength: 10, vitality: 8, ... },
    },
    exclusiveEvents: ['child_rescue', 'teach_fight', 'ransom_trap', 'farewell'],
    weightModifiers: {
        eventWeights: { shop: +5, event: +5 },
    },
    unlocks: {
        skills: ['护犊'],            // 解锁功法"护犊"（队友受伤时触发）
    },
    unlock: { type: 'event_choice', eventId: 'street_incident', optionIndex: 2 },
    // 需要在通用事件"街头意外"中选择"救助小孩"才会解锁此背景
}
```

### 7.4.4 故事背景的解锁链

```
一局游戏的典型流程：

1. 开局 → 从「已解锁」的故事背景中抽 3 个，玩家选 1
2. 选定后 → 该背景的 unlocks 全部生效
   (选手/奇物/功法/事件 加入可用池)
3. 游戏中 → 遭遇解锁事件 → 背景的 unlock 条件满足
   → 该背景进入"已解锁"池 → 下一局可抽到
```

每局结束时，根据本局完成的内容解锁新的故事背景，形成 roguelite 的渐进解锁循环。

---

## 7.5 通用解锁系统

### 7.5.1 原则

**一切皆可解锁。** 选手、故事背景、奇物、功法、招式、义体、御物、甚至机制本身（如"第一次击败 X 后才开放义体系统"）。

### 7.5.2 解锁条件类型

```ts
type UnlockCondition =
    | null // 初始可用
    | { type: 'story_choice'; storyId: string } // 选择某故事背景
    | { type: 'first_encounter'; opponentId: string } // 首次遇到某选手
    | { type: 'defeat_opponent'; opponentId: string } // 击败某选手
    | { type: 'event_choice'; eventId: string; optionIndex: number } // 事件中选择某选项
    | { type: 'attr_threshold'; attr: AttrName; min: number } // 属性达标
    | { type: 'forging_level'; level: number } // 锻体等级达标
    | { type: 'won_round'; round: number } // 打到第几轮
    | { type: 'won_tournament' } // 通关过一次
    | { type: 'has_item'; itemId: string } // 拥有某物品
    | { type: 'and'; conditions: UnlockCondition[] } // 且
    | { type: 'or'; conditions: UnlockCondition[] } // 或
```

### 7.5.3 解锁条目

```ts
interface UnlockEntry {
    id: string
    condition: UnlockCondition

    // 解锁的内容
    unlocks: {
        opponents?: string[]
        storyBackgrounds?: string[]
        events?: string[]
        artifacts?: string[]
        skills?: string[]
        actions?: string[]
        implants?: string[]
        // 特殊机制解锁
        enableMechanics?: ('implant' | 'forging' | 'lifebound')[]
    }
}
```

### 7.5.4 解锁链示例

```text
初始可用:
  └─ 32 强中的 20 位选手
  └─ 3 个故事背景（心魔/发小对决/复仇）
  └─ 基础功法池（10 个）
  └─ 基础招式池（15 个）
  └─ 义体系统（已开放）
  └─ 锻体系统（已开放）

击败守门人后:
  └─ 解锁 5 位新选手（原"未露面"的高手）
  └─ 解锁故事背景「黑马」

通关一次后:
  └─ 解锁故事背景「旧日轮回」
  └─ 解锁奇物「轮回印记」
  └─ 解锁第 31 人隐藏 Boss 的出场资格

事件「街头意外」选"救助小孩":
  └─ 解锁故事背景「托孤」
  └─ 如本局同时有"师傅"类功法，解锁"护犊"

锻体达到 Lv.5:
  └─ 解锁故事背景「苦行僧」
  └─ 解锁奇物「舍利子」

首次遇到谢云疏:
  └─ 解锁功法「残心」
  └─ 解锁事件「剑庐传承」
  └─ 解锁选手「武藏」（需先击败谢云疏）
```

---

## 7.6 选手池生成与缩放

### 7.6.1 三阶段分配

```
第一阶段（~8-10 节点）:
  对手池: 故事背景决定的第一阶段 Boss
  路人: 无流派路人 × 随机属性

第二阶段（~8-10 节点）:
  守门人: 从"已解锁"的 32 强中随机选 1 位
  路人: 无流派路人 / 低配选手（属性减半）

第三阶段（大赛·32 强）:
  从"已解锁"的选手中随机分配 31 个名额
  未解锁选手不会出现在本局
```

### 7.6.2 缩放公式

```ts
const PHASE_MULTIPLIER = {
    phase1_boss: 0.6,
    phase2_gate: 1.0,
    group_stage: 1.1,
    round_of_8: 1.3,
    round_of_4: 1.5,
    semi_final: 1.7,
    final: 2.0,
}

function scaleOpponent(base: OpponentData, phase: keyof typeof PHASE_MULTIPLIER) {
    const m = PHASE_MULTIPLIER[phase]
    return {
        attrs: Object.fromEntries(Object.entries(base.baseAttrs).map(([k, v]) => [k, Math.round(v * m)])),
        // 功法/招式/义体按轮次概率配备
    }
}
```

### 7.6.3 强度预期

```
阶段                 最高属性    6 维合计
  第一阶段 Boss:       ~10       ~25-35
  第二阶段 守门人:     ~15       ~40-55
  小组赛:              ~12       ~35-50
  8 强:                ~15       ~45-60
  4 强:                ~17       ~55-70
  半决赛:              ~18       ~60-75
  决赛:                ~20       ~65-80
```

---

## 7.7 节点权重修正体系

```ts
interface StorylineWeightModifier {
    eventWeights?: Partial<Record<EventType, number>>
    styleBias?: Record<string, number>
    shopBias?: { itemTypes?: string[] }
}

type EventType = 'battle' | 'event' | 'shop' | 'implant' | 'forging'
```

示例（心魔线）：

```ts
{
    eventWeights: { battle: -5, event: +10, forging: +5 },
    styleBias: { phantom: 1.5, broken_katana: 0.7 },
}
```

微调范围控制在 ±10 百分点以内，不颠覆随机性，只制造叙事倾向。

---

## 7.8 下一步

本章定义的数据骨架，后续填充：

1. **32+ 选手**：每个选手一套完整数据（属性/招牌/叙事/解锁/特殊机制）
2. **10+ 故事背景**：每个背景一个第一阶段 Boss + 专属事件池 + 解锁内容
3. **解锁网络**：完整的解锁 DAG，确保不产生死锁
4. **事件表**：每个事件的选项、条件、结果数据
5. **奇物/功法/义体**：关联到解锁条件
