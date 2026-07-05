# 第 3 章：属性、功法与招式

---

## 3.1 六大属性

```ts
type AttrName = 'strength' | 'vitality' | 'agility' | 'dexterity' | 'insight' | 'wisdom'
```

| 属性 | 英文      | 作用                                           |
| ---- | --------- | ---------------------------------------------- |
| 力道 | strength  | 伤害缩放、招架减伤                             |
| 体质 | vitality  | HP = 20 + vit×10                               |
| 身法 | agility   | 命中(防御方)、移动效率(agi/20 档/AP)、回合间隔 |
| 灵巧 | dexterity | 命中(攻击方)、暴击率                           |
| 洞察 | insight   | 命中(攻防双方)、暴击率、招架率                 |
| 推演 | wisdom    | 触发槽数、缔炁效果时长                         |

属性范围：默认 3-20，上限 30。

### 回合间隔

```ts
间隔 = (1200 + PRE_DELAY + STUN_TIME) × 2.8 / (1 + agi × 0.25)
```

| 身法 | 约等同间隔 | 每秒行动次数 |
| ---- | ---------- | ------------ |
| 8    | ~5700ms    | 0.18         |
| 12   | ~4800ms    | 0.21         |
| 18   | ~3600ms    | 0.28         |
| 24   | ~2800ms    | 0.36         |

高身法角色行动更频繁，是风筝/控制 build 的核心属性。

### 触发槽数

```ts
槽数 = max(1, floor(wis / 4))
```

| 推演  | 槽数 |
| ----- | ---- |
| ≤7    | 1    |
| 8-11  | 2    |
| 12-15 | 3    |
| 16-19 | 4    |
| 20+   | 5+   |

---

## 3.2 标签系统（Tag）

```ts
type Tag =
    | 'slash'
    | 'unarmed'
    | 'pierce'
    | 'parry'
    | 'imperial'
    | 'stagger'
    | 'paralyze'
    | 'poison'
    | 'interrupt'
    | 'stun'
    | 'cleanse'
    | 'bleed'
    | 'counter'
    | 'ignore_parry'
    | 'fixed_damage'
    | 'self_damage'
    | 'knockback'
    | 'cripple'
    | 'implant'
    | 'heal'
    | 'buff'
```

所有 `GameEntity`（武器/招式/被动/奇物）都有 `tags: Tag[]`。

---

## 3.3 被动系统（Passive）

### 数据结构

```ts
interface Passive extends GameEntity {
    effects?: EffectDef[] // 构造期执行的持久效果
    triggers?: TriggerSlot[] // 注入的触发器
    modifiers?: string[] // 修饰器名（如 'minMoveCost'）
}

interface Talent extends Passive {
    requireAttrs: Partial<Record<AttrName, number>> // 达标检测
}
```

### 构造期执行

`Character` 构造函数处理流程：

1. 解析被动 ID → `Passive` 对象
2. 解析奇物/义体 ID → `Artifact` 对象
3. 对每个 passive 调用 `#applyPassive`：
    - effects → `passiveEffectHandlers` 分发表
    - triggers → 加入 `passiveTriggers`（不污染 build）
    - modifiers → 加入 `modifiers` Set
    - Talent 额外检测 `requireAttrs`：属性不足则跳过 effects
4. 处理奇物/武器 effects 同样走 `passiveEffectHandlers`

### 现有被动

| ID                 | 名称       | 效果                                                                 |
| ------------------ | ---------- | -------------------------------------------------------------------- |
| `forge`            | 三分归元气 | STR/VIT/AGI/DEX +2；HP<30% 时触发「三分归元」回血 30+30% 后失去 buff |
| `iron_bone`        | 钢筋铁骨   | （暂无效果，占位）                                                   |
| `spirit_resonance` | 灵炁共鸣   | STR -2，召唤物伤害 +2                                                |

### 现有天赋

| ID               | 名称     | 需求   | 效果                                   |
| ---------------- | -------- | ------ | -------------------------------------- |
| `ling_bo_wei_bu` | 凌波微步 | AGI≥18 | 闪避触发洞察+1；最低移动消耗（2档/AP） |

---

## 3.4 招式系统（Action）

### 数据结构

```ts
interface ActionDefinition extends GameEntity {
    requiredTags: Tag[] // 需要武器有这个 tag
    apCost: number
    effects?: EffectDef[]
    target?: 'self' | 'enemy'
    chance?: number // 固定命中率（不设则用属性公式）
    maxUses?: number
    bonus?: boolean // 辅招？
    bonusTiming?: Condition // 辅招触发时机
    extraPreDelay?: number // 额外前摇
    extraStunTime?: number // 额外硬直
    range?: [number, number] // 射程
}
```

### 招式分类

招式分为三类：

**主招（Main Action）**：每回合最多一个，通过 AI 或队列选择。如正拳、崩拳、刺击。

**辅招（Bonus Action）**：`bonus: true`，在特定时机通过 `#tryBonus` 触发。如凝炁（before_main）、聚炁（before_main）。

**触发器招式（Trigger Action）**：通过被动触发器系统触发，`target: 'self'` 通常为触发者自己。如 `_sangui_heal`（三分归元）。

### 注册表

所有招式在 `data/actions.ts` 中合并：

```ts
const ALL_ACTIONS = [...MVP_ACTIONS, ...BONUS_ACTIONS, ...QI_SKILLS, ...TRIGGER_ACTIONS]
```

通过 `getAction(id)` 按 ID 查找。

### 辅招（Forging/Qi Skills）

定义在 `data/forging.ts`：

| ID           | 名称 | AP  | 类型                   | 效果                |
| ------------ | ---- | --- | ---------------------- | ------------------- |
| `qi_focus`   | 凝炁 | 1   | before_main, maxUses=1 | 全属性 +2（有时长） |
| `qi_gather`  | 聚炁 | 1   | before_main, maxUses=1 | 力量翻倍（有时长）  |
| `qi_bolt`    | 炁弹 | 1   | 主招                   | 固定伤害 4，远程    |
| `restore_ap` | 回炁 | 0   | 触发器                 | 恢复 1 AP           |

---

## 3.5 奇物与义体

### 奇物（Artifact）

```ts
interface Artifact extends GameEntity {
    tags: Tag[]
    effects?: EffectDef[] // 构造期执行
}
```

### 义体（Implant）

义体是奇物的一种，通过 `tags: ['implant']` 标识。无独立接口，与奇物共用 `Artifact`。

现有义体：

| ID               | 名称         | 效果          | 代价                             |
| ---------------- | ------------ | ------------- | -------------------------------- |
| `titanium_arm`   | 钛合金臂     | STR/DEX +4    | AGI -2                           |
| `hydraulic_leg`  | 液压腿       | 移动效率 +20% | AGI -1                           |
| `mechanical_eye` | 机械眼球     | INS +2        | maxAP -1                         |
| `muscle_boost`   | 肌肉强化针   | STR/VIT +2    | maxHP -20                        |
| `heart_pump`     | 心肺泵       | 全属性 +1     | maxAP -2                         |
| `neural_net`     | 人造神经网络 | AGI/DEX/INS + | 失心 5%                          |
| `combat_chip`    | 战斗芯片     | WIS +4        | 失心 5%                          |
| `power_furnace`  | 便携式动力炉 | maxAP +4      | 永久灼烧（每秒 1 伤害，间隔 2s） |

---

## 3.6 属性缩放与伤害

招式伤害通过 `EffectDef` 的 `damage` 类型定义：

```ts
{ type: 'damage', scaling: { strength: 0.4 } }
// 伤害 = 0.4 × 角色力道
```

各系招式典型缩放：

| 系   | 典型缩放  | 武器举例  |
| ---- | --------- | --------- |
| 拳掌 | strength  | 赤手空拳  |
| 长枪 | strength  | 铁枪·破军 |
| 暗器 | dexterity | 飞针/毒镖 |
| 御物 | wisdom    | 三才法珠  |
