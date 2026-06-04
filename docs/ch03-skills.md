# 第 3 章：属性系统、功法与招式

---

## 3.1 六大属性总览

```ts
// 代码中使用英文全称
type AttrName = 'strength' | 'vitality' | 'agility' | 'dexterity' | 'insight' | 'wisdom'

// 使用示例
interface Character {
    attrs: Record<AttrName, number> // { strength: 12, vitality: 14, ... }
    maxHp: number // 20 + vitality * 10
}
```

```
strength  (力道 STR) ──→ 基础伤害加成、招架率、招架减伤、抗失衡
vitality (根骨 VIT) ──→ HP(20+vit×10)、抗失衡
agility  (身法 AGI) ──→ 闪避、移动效率(agi/20 档/AP)、回合间隔、招架率
dexterity(灵巧 DEX) ──→ 命中、暴击率、招架率
insight  (洞察 INS) ──→ 命中、闪避、暴击、招架率、偷学
wisdom   (悟性 WIS) ──→ 触发槽数(floor(wis/4))、炼炁(wis≥12)
```

> **属性范围参考（D&D 风格）：** 初始 3-8，正常流程可达 12-20，极值最多 30。
> 整体数值控制在 500 以内，HP 上限 ~320。

---

## 3.2 属性详解

### 3.2.1 strength（力道）

| 影响         | 公式/说明                                                   |
| ------------ | ----------------------------------------------------------- |
| 基础伤害加成 | `action.attrScaling.strength × attrs.strength / 20`         |
| 招架减伤     | `calcParriedDamage(damage, strength)`：力道决定减免 20%-60% |
| 抗失衡       | 每 2 strength 减少 1% 失衡率（义体/重武器惩罚）             |
| 重武器需求   | 部分招式/武器有最低 strength 要求                           |

> **高力道特色**: 重武器 build（大刀、长枪），高伤低攻速，高招架减伤

### 3.2.2 vitality（根骨）

| 影响    | 公式/说明                                                                  |
| ------- | -------------------------------------------------------------------------- |
| 最大 HP | `20 + attrs.vitality × 10`（vit10=120, vit20=220, vit30=320）              |
| 抗失衡  | 每 2 vitality 减少 1% 失衡率                                               |
| 抗 dot  | _待实现_：流血伤害 -`attrs.vitality / 10`，中毒伤害 -`attrs.vitality / 12` |

> **高根骨特色**: 坦克 build，血量厚

### 3.2.3 agility（身法）

| 影响               | 公式/说明                                     |
| ------------------ | --------------------------------------------- |
| 闪避率（防御修正） | `attrs.agility / 50`（命中公式防御区）        |
| 移动效率           | 每 AP 移动 `attrs.agility / 20` 档            |
| 回合间隔           | `600 + 60000 / (100 + attrs.agility × 5)` ms  |
| 招架率             | 身法+灵巧+洞察共同决定（见 3.2.1 招架率公式） |
| 凌波微步           | agility ≥ 16 && wisdom ≥ 12 时解锁            |

> **高身法特色**: 风筝 build，回合快、移动远、闪避高、兼得招架

### 3.2.4 dexterity（灵巧）

| 影响                 | 公式/说明                                                 |
| -------------------- | --------------------------------------------------------- |
| 命中加成（攻击修正） | `attrs.dexterity / 50`                                    |
| 暴击率               | `(attrs.dexterity + attrs.insight) / 200`（与洞察叠加）   |
| 招架率               | 身法+灵巧+洞察共同决定（见 3.2.1 招架率公式）             |
| 左右互博             | dexterity ≥ 18 && wisdom ≤ 6 时解锁（每回合额外一次普攻） |

> dexterity 影响**命中精度和暴击率**，但**不直接影响武器伤害**。
> 武器伤害的 attrScaling 在各招式 data 中单独定义，匕首/暗器的招式可能将 dexterity 设为高缩放系数。
>
> **高灵巧特色**: 高命中高暴击兼招架率，左右互博质变

### 3.2.5 insight（洞察）

| 影响                 | 公式/说明                                               |
| -------------------- | ------------------------------------------------------- |
| 命中加成（攻击修正） | `attrs.insight / 60`                                    |
| 闪避加成（防御修正） | `attrs.insight / 60`                                    |
| 暴击率               | `(attrs.dexterity + attrs.insight) / 200`（与灵巧叠加） |
| 招架率               | 身法+灵巧+洞察共同决定                                  |
| 偷学                 | insight ≥ 16 && wisdom ≥ 12 时解锁                      |

> **高洞察特色**: 全能型，命中闪避暴击招架都沾，特殊能力是偷学

### 3.2.6 wisdom（悟性）

| 影响     | 公式/说明                                    |
| -------- | -------------------------------------------- |
| 触发槽数 | `Math.max(1, Math.floor(attrs.wisdom / 4))`  |
| 炼炁解锁 | wisdom ≥ 12 时解锁炼炁系统                   |
| 绝学需求 | 部分绝学有最低 wisdom 要求                   |
| -------- | -------------------------------------------- |
| 触发槽数 | `Math.max(1, Math.floor(attrs.wisdom / 20))` |
| 炼炁解锁 | wisdom ≥ 60 时解锁炼炁系统                   |
| 高阶功法 | 部分高阶功法有最低 wisdom 要求               |
| 组合功法 | wisdom + otherAttr → 凌波微步、偷学、等      |

> **高悟性特色**: 触发器多、炼炁、高阶功法——"聪明人"路线

---

## 3.3 绝学系统（属性阈值解锁）

> **绝学是功法的一种特殊子类型**。它在数据结构上等同于 `SkillDefinition`，唯一的区别是获取途径：绝学通过属性达标后自动领悟，而非从事件/商店获取。

**绝学**是通过属性修炼达到特定阈值后领悟的专属能力。与普通功法不同，绝学具有唯一性——每个属性只对应一门绝学。

```ts
interface SecretArt {
    id: string
    name: string
    requiredAttributes: Partial<Record<AttrName, number>>
    effect: SecretArtEffect
}

type SecretArtEffect =
    | { type: 'stat_modifier'; stat: string; multiplier: number }
    | { type: 'event_trigger'; event: EventBusEvent; effect: Effect }
    | { type: 'system_unlock'; system: 'qi' }
    | { type: 'combo'; arts: string[] }
```

### 3.3.1 单属性绝学

| 属性      | 阈值 | 绝学                      | 效果                                                   | 设计思路           |
| --------- | :--: | ------------------------- | ------------------------------------------------------ | ------------------ |
| strength  | ≥14  | 力贯千钧 (Force Through)  | 重招（AP≥6）命中时，目标硬直 +200ms                    | 以力服人           |
| vitality  | ≥14  | 刚体 (Tough Body)         | 被 ≥20% 最大HP 的单次攻击命中时，免疫击退和眩晕 1 回合 | 大难不死，反打窗口 |
| agility   | ≥16  | 凌波微歩 (Graceful Steps) | 闪避 ×1.5，移动效率 +50%                               | 经典轻功           |
| dexterity | ≥16  | 点穴 (Pressure Point)     | 命中后附加 1 层「气滞」（每层 +100ms 前摇），上限 3 层 | 控制技能增加前摇   |
| insight   | ≥14  | 偷学 (Thief of Fate)      | 被命中后 25% 概率复制对方一个功法（本场）              | 洞察的核心特色     |
| wisdom    | ≥12  | 炼炁解锁 (Qi Awakening)   | 开启炼炁系统（见第 4 章）                              | 系统级 unlock      |

### 3.3.2 双属性组合绝学

> 原则：不做纯数值加减。每个绝学改变**行为方式**而非数字。

| 组合                 | 需求  | 功法                     | 效果                                                | 思路               |
| -------------------- | :---: | ------------------------ | --------------------------------------------------- | ------------------ |
| strength + dexterity | 各≥12 | **寸劲** (Inch Force)    | 暴击时无视 30% 防御                                 | 力巧合一，穿透打击 |
| vitality + wisdom    | 各≥12 | 气定神闲 (Serene Mind)   | 每回合开始时，清除 1 个随机 debuff                  | 自动净化           |
| agility + dexterity  | 各≥14 | **暗影步** (Shadow Step) | 闪避距离 ≤ 2 的攻击后，瞬移到距离 4，下次回合 +1 AP | 闪避→紫烟→反手     |
| insight + wisdom     | 各≥12 | 偷天换日 (Stellar Swap)  | 被命中后 20% 复制对方一个功法（本场）               | 你的就是我的       |

**每种属性出现的双属性绝学数：**

```
strength  → 1 (寸劲)
vitality  → 1 (气定神闲)
agility → 2 (暗影步, 凌波微歩)
dexterity → 2 (寸劲, 暗影步)
insight   → 1 (偷天换日)
wisdom    → 3 (气定神闲, 凌波微歩, 偷天换日)
```

### 3.3.3 特殊条件绝学

| 绝学                           | 条件                       | 效果                               | 思路             |
| ------------------------------ | -------------------------- | ---------------------------------- | ---------------- |
| 左右互博 (Double Strike)       | dexterity ≥ 18, wisdom ≤ 6 | 每回合额外一次随机普攻（50% 伤害） | 勤能补拙，反应快 |
| 返璞归真 (Return to Innocence) | wisdom ≥ 18, 无任何功法    | 所有属性 +5                        | 白板流补偿       |

---

## 3.4 功法系统（可学习/修炼的被动）

### 3.4.1 设计原则

- 功法是**被动效果**，不消耗 AP
- 大部分功法有**多属性因子**（不止一种属性影响）
- 功法之间**共享池**——不同 build 可以拿同一个功法
- 每个功法可能属于多个 build 的策略

### 3.4.2 功法数据结构

```ts
interface SkillDefinition {
    id: string
    name: string
    description: string

    requirements?: Partial<Record<AttrName, number>>

    trigger: {
        event: EventBusEvent
        condition?: TriggerCondition
    }

    effects: Effect[]

    tags: SkillTag[]
}

type SkillTag = 'offensive' | 'defensive' | 'mobility' | 'dot' | 'crit' | 'parry' | 'qi' | 'implant' | 'trigger_enhance'
```

---

## 3.5 招式系统 (Actions)

### 3.5.1 设计原则

- 招式是**主动消耗 AP** 的行动，无蓝条
- **招式本身不带基础伤害、命中乘区、前摇、硬直**——这些由武器类型统一决定
- 招式只定义：名称、AP 消耗、最佳距离、**效果机制**
- 效果是招式差异化核心——不做纯数值伤害加成

```ts
// 每个武器类型统一定义
const WEAPON_STATS: Record<WeaponType, WeaponStats> = {
  fist:    { attrScaling: { strength: 0.8 },            preDelay: 250, stunTime: 300, range: [0, 2] },
  sword:   { attrScaling: { strength: 0.6, dexterity: 0.4 }, preDelay: 350, stunTime: 400, range: [1, 3] },
  spear:   { attrScaling: { strength: 1.0 },            preDelay: 450, stunTime: 500, range: [2, 4] },
  thrown:  { attrScaling: { dexterity: 0.8 },           preDelay: 200, stunTime: 200, range: [2, 5] },
  control: { attrScaling: { wisdom: 1.0 },              preDelay: 400, stunTime: 350, range: [3, 6] },
}

// 伤害公式（无基础伤害，纯属性决定）
actionDamage = Σ(attrScaling[attr] × attrs[attr])
// 例：正拳 strength=14 → 0.8×14 = 11.2 ≈ 11
// 例：崩拳 strength=16 → 1.2×16 = 19.2 ≈ 19
// 例：HP=160(vit14)，正拳约 14 下击杀
```

### 3.5.2 招式数据结构

```ts
interface ActionDefinition {
    id: string
    name: string
    actionCost: number // AP 消耗
    bestDistance: number // 最佳距离
    effects: Effect[] // 效果机制
    maxUses?: number // 每场限用次数
    bonus?: boolean // 辅招？不占主招名额
}

interface WeaponStats {
    attrScaling: Partial<Record<AttrName, number>>
    preDelay: number // 武器统一前摇 (ms)
    stunTime: number // 武器统一硬直 (ms)
    range: [number, number] // 攻击范围
}
```

### 3.5.3 招式执行逻辑

#### 主招（Main Action）— 队列顺序执行

每回合**最多执行 1 个主招**。玩家配置一个主招队列（按优先级排序），引擎按顺序检测：

```
1. 居合 (7AP)  → AP ≥ 7?   是 → 距离合适? 是 → 执行居合，主招结束
2. 刺击 (4AP)  → AP ≥ 7?   否 → 跳过
                → AP ≥ 4?   是 → 距离合适? 是 → 执行刺击，主招结束
3. 正拳 (3AP)  → AP ≥ 4?   否 → ...
                → AP ≥ 3?   是 → 执行正拳
4. 都不满足     → 跳过主招，AP 留到移动/辅招
```

检测条件：

```
- AP 是否足够 (actionCost)
- 距离是否在武器范围内
- 自身状态（如被眩晕则跳过）
- 对方状态（如无敌则跳过）
- 招式自身的 maxUses 是否已耗尽
```

如果队列中所有招式都不满足条件，则**跳过主招**，AP 留给移动或辅招。

#### 辅招（Bonus Action）— 固定时机 + 固定条件

辅招没有触发器（trigger system），只有**固定的释放时机 + 固定条件**，玩家只需选择"带不带"：

```ts
interface BonusActionDefinition {
    actionId: string
    triggerTiming: BonusTriggerTiming // 固定时机
    condition?: BonusCondition // 固定条件（内置，不可配置）
}

type BonusTriggerTiming =
    | 'after_main' // 主招后执行
    | 'before_turn_end' // 回合结束前
    | 'on_hit' // 自己命中对手时
    | 'on_take_damage' // 自己受伤时
    | 'on_dodge' // 自己闪避时
    | 'on_parry' // 自己招架时
    | 'turn_start' // 回合开始时

interface BonusCondition {
    hpBelow?: number // 血量低于 %
    enemyDistance?: number // 对手在特定距离
    statusOnSelf?: string // 自身有某状态
    statusOnEnemy?: string // 对手有某状态
}
```

示例：

```
「凝炁」(bonus, 1AP) — triggerTiming: 'after_main', condition: { hpBelow: 50 }
  → 主招后且 HP < 50% 时自动消耗 1AP 开凝炁，让下次主招必爆

「愈炁」(bonus, 2AP) — triggerTiming: 'before_turn_end', condition: { hpBelow: 30 }
  → 回合结束前且 HP < 30% 时自动回血
```

玩家在准备阶段配置要携带的辅招（受 slot 限制），战斗中按固定逻辑自动触发，不需要手动操作。

### 3.5.4 MVP 招式清单

> 每招必须有独一无二的机制决策点。不重复。

#### 拳掌/格斗系

> scaling: strength×0.8 | preDelay 250 | stunTime 300 | range [0,2]

| 招式   | AP  | 效果                                           |
| ------ | :-: | ---------------------------------------------- |
| 正拳   |  3  | —（基础攻击）                                  |
| 崩拳   |  6  | **崩劲**：对高血量目标额外伤害(目标已损HP×10%) |
| 铁山靠 |  7  | 附加 失衡 2 层；自己 -3% HP                    |
| 弹指   |  2  | 打断对方前摇；混合标签：拳掌/暗器系皆可使用    |

#### 刀剑系

> scaling: strength×0.6, dexterity×0.4 | preDelay 350 | stunTime 400 | range [1,3]

| 招式 | AP  | 效果                                   |
| ---- | :-: | -------------------------------------- |
| 横斩 |  4  | —（基础攻击）                          |
| 居合 |  7  | **先制**：本回合先于对方出手           |
| 燕返 |  5  | 若被闪避则追加一次必中反击（80% 伤害） |

#### 长枪/重武器系

> scaling: strength×1.0 | preDelay 450 | stunTime 500 | range [2,4]

| 招式     | AP  | 效果                                                    |
| -------- | :-: | ------------------------------------------------------- |
| 刺击     |  4  | —（基础攻击）                                           |
| 横扫千军 |  6  | **范围**：同时影响"距离差 ≤ 1"的所有目标（Boss 战适用） |
| 裂地击   |  8  | 附加 失衡 2 层；**无视招架**                            |

#### 暗器系

> scaling: dexterity×0.8 | preDelay 200 | stunTime 200 | range [2,5]

| 招式     | AP  | 效果                                                    |
| -------- | :-: | ------------------------------------------------------- |
| 飞针     |  3  | 附加 麻痹 1 层（对方下次动作前摇 +200ms）               |
| 毒镖     |  5  | 附加 中毒 1 层                                          |
| 暴雨梨花 |  8  | 固定伤害 15，无视属性加成；命中 +15%；每场战斗限用 2 次 |

#### 御物系

> scaling: wisdom×1.0 | preDelay 400 | stunTime 350 | range [3,6]

| 招式     |      AP       | 效果                                                                              |
| -------- | :-----------: | --------------------------------------------------------------------------------- |
| 御剑     |       5       | 操控御物攻击；距离 ≥ 4 时命中 +8%                                                 |
| 御剑防御 | 0（常驻被动） | 御物自动招架，招架率 = wisdom / 60 + 0.30，招架减伤 = wisdom / 50（不受力量影响） |
| 御器冲击 |       7       | 御物全力冲撞，击退 2 档；冷却 2 回合                                              |

---

## 3.6 "共享池"——为什么招式/功法不做独占锁定

### 3.6.1 设计目标

大多数功法和招式不被锁定给特定 build。同一招式在不同属性分配下产生不同的效果曲线，创造"非最优但可用"的选择空间，增加 replayability。

### 3.6.2 招式共享例

```
「正拳」(fist, 3AP)  — scaling strength×0.8
  力量 18 时伤害 ≈ 14 → 可作主力输出
  力量 10 时伤害 ≈ 8  → 作为低费填充技，省 AP 移动

「崩拳」(fist, 6AP)  — 附加 麻痹
  坦克拿它当控制技（打硬直后跟裂地击）
  刺客拿它当追击技（普攻后补麻痹）

「弹指」(2AP)  — 打断 + 混合标签
  任何 build 都可以塞 2AP 打断当万用工具
  只是打断成功与否看双方 dexterity 差值
```

### 3.6.3 功法共享例

```
「钢筋铁骨」— 被眩晕/减速时解控
  坦克：标配，防被风筝时一波控死
  刺客：保险，怕被反控后暴毙
  风筝：不太需要（本身高闪避），但可以防意外

「缩地成寸」— 敌方距 ≤ 1 瞬移到 4
  风筝 build：核心，近战贴脸自动拉开
  御物 build：保命手段，被近身后可以瞬走
  坦克：几乎不需要（我想被贴脸）
```

### 3.6.4 共享机制的好处

1. **自然引导**——玩家不需要看攻略，试几次就知道哪些招式/功法适合自己的属性
2. **临时替代**——拿不到理想技能时，同武器类型的任何招式都可以填补
3. **惊喜组合**——坦克拿 飞针 上麻痹 + 崩拳 续麻痹，形成远程控制流
4. **Build 宽松**——不会因为少拿一个核心技能就"废档"

### 3.6.5 唯一例外：绝学

`SecretArt` 确实有属性门槛（如 `requiredAttributes: { strength: 14 }`），这是唯一硬性锁定的系统。但绝学只有 6 个单属性 + 4 个双属性 + 3 个特殊条件，覆盖率低，不影响整体灵活性。

---

> **第 3 章完成。** 下一章：第 4 章 触发器 + 义体 + 炼炁系统。
