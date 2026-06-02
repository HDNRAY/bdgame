# 第 2 章：战斗引擎与伤害系统

---

## 2.1 伤害哲学

《单挑》的伤害由两部分构成：

| 来源         | 占比（目标） | 说明                             |
| ------------ | :----------: | -------------------------------- |
| 标准公式伤害 |     ~30%     | 保底伤害，确保无 build 也能战斗  |
| 效果链伤害   |     ~70%     | 招式效果 + 功法被动 + 触发器联动 |

标准公式**保留但刻意简化**。通过技能设计，实际战斗中绝大部分伤害来自效果链的连锁反应。

---

## 2.2 攻击判定流程（三层防御）

一次攻击经过三层判定，**不是**一个公式算到底：

```
招式发出
  │
  ▼
┌─────────────────┐
│ 第0层：距离检查  │  攻击范围能否覆盖当前距离？
└──────┬──────────┘
       │ 超出范围 → 无法出手！必须移动
       │ 范围内
       ▼
┌─────────────────┐
│ 第1层：命中判定  │  攻击方灵巧/洞察 vs 防御方身法/洞察 vs 距离
└──────┬──────────┘
       │ MISS → 闪避事件（流血等dot仍触发！）
       │ HIT
       ▼
┌─────────────────┐
│ 第2层：招架判定  │  需武器或义体；力道/根骨决定招架率和减伤
└──────┬──────────┘
       │ 未招架 → 进入正常伤害计算
       │ 招架成功 → 减伤后进入伤害计算
       ▼
┌─────────────────┐
│ 第3层：伤害计算  │  五乘区公式
└─────────────────┘
```

---

## 2.3 第1层：命中判定（Hit Check）

### 2.3.1 命中乘区模型

```
命中率 = 基础命中区 × 攻击修正区 × 防御修正区 × 距离修正区 × 特殊修正区
```

命中率 clamp 到 `[0.05, 0.95]`。

### 2.3.2 基础命中区

```ts
baseAccuracy = 招式.accuracy // 每招固定值，如 正拳=0.95, 回旋踢=0.85
```

### 2.3.3 攻击修正区

```ts
// 攻击方属性带来的命中加成（加算）
attackerBonus = 1 + attacker.灵巧 / 300 + attacker.洞察 / 400

// 例：灵巧60, 洞察40 → 1 + 0.2 + 0.1 = 1.30
```

### 2.3.4 防御修正区

```ts
// 防御方属性带来的闪避（加算，取倒数）
defenderPenalty = 1 / (1 + defender.身法 / 300 + defender.洞察 / 400)

// 例：对方身法80, 洞察30 → 1 / (1 + 0.267 + 0.075) = 1 / 1.342 = 0.745
```

### 2.3.5 距离修正区

```
距离差 = |实际距离 - 招式最佳距离|

距离差 → 命中修正:
  0 (最佳) → 1.00
  1        → 0.85
  2        → 0.65
  ≥3       → 0.40
```

### 2.3.6 特殊修正区

```ts
// 默认 1.0，特定功法/效果修改
// 例：御物 在 炼炁 等级高时获得命中加成
specialHitMult = 1.0

// 御物特殊规则：
if (action.type === '御物') {
    // 御物命中 = 炼炁等级 × 0.05 加成
    specialHitMult += attacker.炼炁等级 * 0.05
}

// 例：暗器在对方有义体"雷达"时命中降低
if (action.type === '暗器' && defender.hasImplant('雷达')) {
    specialHitMult *= 0.7
}
```

### 2.3.7 完整命中判定（含出手检查）

```ts
function resolveHitCheck(
    attacker: Character,
    defender: Character,
    action: ActionDefinition,
    distance: number,
): HitResult {
    // 第0层：距离检查——能否出手？
    if (!canAttack(attacker, action, distance)) {
        return { type: 'out_of_range' }
        // 无法出手，浪费本回合（除非可以移动后重新选择）
    }

    // 第1层：命中判定
    const accuracy = calcAccuracy(attacker, defender, action, distance)
    if (Math.random() > accuracy) {
        return { type: 'miss' }
    }

    return { type: 'hit' }
}

function calcAccuracy(attacker: Character, defender: Character, action: ActionDefinition, distance: number): number {
    const base = action.accuracy
    const atk = 1 + attacker.灵巧 / 300 + attacker.洞察 / 400
    const def = 1 / (1 + defender.身法 / 300 + defender.洞察 / 400)
    const dist = DISTANCE_HIT_TABLE[Math.abs(distance - action.bestDistance)]
    const special = calcSpecialHitMultiplier(attacker, defender, action)

    return clamp(base * atk * def * dist * special, 0.05, 0.95)
}
```

---

## 2.4 第2层：招架判定（Parry Check）

### 2.4.1 招架条件

```ts
canParry = defender.weapon !== '空手' || defender.hasImplant
// 空手且无义体 → 无法招架
```

### 2.4.2 招架率

```ts
parryChance = clamp(
    defender.力道 / 400 + defender.根骨 / 500 + Σ(功法招架加成),
    0,
    0.7, // 招架率上限 70%
)

// 例：力道80, 根骨60 → 0.20 + 0.12 = 32% 招架率
```

### 2.4.3 招架减伤

```ts
// 招架成功后，伤害减免比例
parryReduction = clamp(
    defender.力道 / 300 + defender.根骨 / 400,
    0.1, // 最少减免10%
    0.75, // 最多减免75%
)

// 例：力道80, 根骨60 → 0.267 + 0.15 = 41.7% 减伤
// 被招架后的伤害 = 原始伤害 × (1 - 0.417) = 原始伤害 × 0.583
```

### 2.4.4 招架判定流程

```ts
function checkParry(attacker: Character, defender: Character, action: ActionDefinition): ParryResult {
    if (!defender.canParry) return { parried: false, reduction: 0 }

    const chance = calcParryChance(defender)
    if (Math.random() > chance) return { parried: false, reduction: 0 }

    const reduction = calcParryReduction(defender)

    // 招架事件可能触发效果链
    emitEvent('on_parry', { attacker, defender, action, reduction })

    return { parried: true, reduction }
}
```

---

## 2.5 第3层：伤害计算

移除攻防区后，五乘区模型：

```
伤害 = 基础区 × 暴击区 × 距离区 × 效果链区 × 特殊区
```

| 乘区     | 默认值                       | 说明                  | 修改方式             |
| -------- | ---------------------------- | --------------------- | -------------------- |
| 基础区   | `baseDamage + attrBonus`     | 招式基础 + 属性加成   | 功法/Buff 加属性值   |
| 暴击区   | `暴击 ? critMult : 1.0`      | 暴击倍率              | 功法改暴伤           |
| 距离区   | `{最佳:1.0, 偏:0.8, 远:0.5}` | 距离影响伤害          | 几乎不变             |
| 效果链区 | `1.0`（累加）                | on-hit effects 总伤害 | 招式/功法/触发器效果 |
| 特殊区   | `1.0`                        | 自定义 callback       | 极少使用             |

### 2.5.1 基础区

```ts
// 属性加成融入基础区（不再有独立的"攻防区"）
attrBonus = Σ(招式.attrScaling[attr] × character.attrs[attr] / 100)

baseDamage = 招式.baseDamage + attrBonus

// 例：回旋踢 attrScaling: {力道: 1.5, 身法: 0.5}, 力道50, 身法30
// attrBonus = 50/100×1.5 + 30/100×0.5 = 0.75 + 0.15 = 0.9
// baseDamage = 8 + 0.9 = 8.9 → 取整 = 9
```

### 2.5.2 暴击区

```ts
critChance = clamp(0.05 + 灵巧 / 300 + 洞察 / 400 + Σ(buff暴击率), 0, 0.9)
critMultiplier = 1.5 + Σ(功法暴伤加成)
critMult = Math.random() < critChance ? critMultiplier : 1.0
```

### 2.5.3 距离区（伤害修正）

```
距离差(实际-最佳) → 伤害修正:
  0 (最佳) → 1.00
  1        → 0.80
  2        → 0.50
  ≥3       → 0.20
```

**注意**：距离同时影响命中（2.3.5）和伤害（2.5.3），且修正值不同。

### 2.5.4 招架修正

招架成功时，**在乘区外**应用减伤：

```ts
if (parryResult.parried) {
    damage = damage * (1 - parryResult.reduction)
}
```

### 2.5.5 完整伤害公式

```ts
function calcDamage(ctx: DamageContext, parry: ParryResult): number {
    // 基础区
    let dmg = ctx.action.baseDamage
    for (const [attr, coeff] of Object.entries(ctx.action.attrScaling)) {
        dmg += (ctx.attacker.attrs[attr] * coeff) / 100
    }

    // 暴击区
    const crit = calcCritMultiplier(ctx)

    // 距离区
    const dist = DAMAGE_DIST_TABLE[Math.abs(ctx.actualDistance - ctx.action.bestDistance)]

    // 特殊区
    const special = calcSpecialMultiplier(ctx)

    dmg = dmg * crit * dist * special

    // 招架减伤（乘区外）
    if (parry.parried) {
        dmg = dmg * (1 - parry.reduction)
    }

    return Math.round(Math.max(dmg, 1)) // 至少1点伤害
}
```

### 2.5.6 减伤去哪了？

移除攻防区后，减伤通过以下方式体现，不再有全局通用减伤公式：

| 减伤来源 | 体现方式                 |
| -------- | ------------------------ |
| 铁布衫   | 功法效果：固定%减伤 buff |
| 招架     | 独立判定层，2.4 节       |
| 义体护甲 | 义体自带减伤 buff        |
| 炁盾     | 炼炁效果：临时护盾       |

```ts
// 减伤现在是一个 buff，在伤害计算后应用
// 不是公式的一部分，是效果链的一部分
damageReduction: Buff = {
    id: 'iron_skin',
    name: '铁布衫',
    type: 'defense',
    value: 0.2, // 减伤 20%
    // 在 after_calc_damage hook 中应用
}
```

---

## 2.6 行动点数与距离系统

### 2.6.1 行动点数（AP）模型

每回合固定 **10 AP**。

```
每回合 = 1 主招 + (0-N 自由动作) + 前后移动

主招：消耗 AP 的主要攻击/技能（一回合最多一个）
辅招 (bonus action)：短耗时、不占主招名额的技能（如锻体、炁盾）
移动：消耗 AP 调整距离，不占动作名额
```

```
回合 AP 分配示例：
  主招 居合 7AP + 辅招 锻体 1AP → 余 2AP → 全部后移动
  主招 崩拳 6AP + 辅招 炁盾 2AP → 余 2AP → 前移动 2AP
  辅招 锻体 1AP + 辅招 炁盾 2AP → 余 7AP → 全前移动（接近战）
```

**只有标记为 `bonus: true` 的技能可用作辅招。** 其余技能一律占主招位，一回合只能用一个。
全部 10AP 前移动（不攻击，调整距离）

```

```

示例：长枪 vs 拳套，当前距离 4

长枪 [范围 2-4]，当前在范围内 ✅
崩拳 6AP → 余 4AP → 全部后退 4AP → 拉开距离

拳套 [范围 0-2]，当前在范围外 ❌
需要先逼近：前移动 4AP 从 4→1.6（身法60, 4×0.6=2.4档，距离=4-2.4=1.6）
正拳 3AP（范围[0,2]，距离1.6 ✅）
余 3AP → 继续贴近 3AP（1.6→0，逼到贴身）

```

> 这个系统让"1 点移动、6 点出招、3 点后退"这种精细操作成为可能。

### 2.6.2 招式 AP 消耗

| 招式类型 | AP  | 示例                 |
| -------- | :-: | -------------------- |
| 快招     | 2-3 | 正拳(3)、刺拳(2)     |
| 中招     | 4-5 | 回旋踢(5)、横扫(4)   |
| 重招     | 6-7 | 崩拳(6)、裂地击(7)   |
| 绝招     | 8-9 | 奥义(9)              |
| 暗器投掷 | 3-5 | 飞针(3)、毒镖(5)     |
| 御物操控 | 4-6 | 御剑(5)、御物连击(6) |

AP 消耗是每招的固定属性，定义在招式数据中。

### 2.6.3 移动效率

```

移动距离（档）= 投入AP × (身法 / 100)

身法 40 → 0.4 档/AP (需 3AP 才能移动 1 档)
身法 60 → 0.6 档/AP (需 2AP 移动约 1 档)
身法 100 → 1.0 档/AP (1AP = 1 档)
身法 150 → 1.5 档/AP (2AP = 3 档)
身法 200 → 2.0 档/AP (1AP = 2 档，满场跑)

````

距离用连续值追踪（如 3.7 档），武器范围判定时四舍五入。

### 2.6.4 前后移动分配

```ts
interface TurnPlan {
    preMoveAP: number             // 前移动消耗的 AP
    mainAction: ActionDefinition  // 主招（一回合一个）
    bonusActions: ActionDefinition[] // 辅招（不占主招名额）
    postMoveAP: number            // 后移动消耗的 AP
    // preMoveAP + mainAction.cost + Σ(freeActions.cost) + postMoveAP ≤ 10
}

function executeTurn(plan: TurnPlan, ctx: BattleContext): void {
    // 1. 前移动
    if (plan.preMoveAP > 0) {
        const dist = plan.preMoveAP * (ctx.attacker.身法 / 100)
        ctx.distance = clamp(ctx.distance - plan.preMoveDirection * dist, 0, 6)
    }

    // 2. 执行招式（含命中/招架/伤害/效果链）
    executeAction(plan.action, ctx)

    // 3. 后移动
    if (plan.postMoveAP > 0) {
        const dist = plan.postMoveAP * (ctx.attacker.身法 / 100)
        ctx.distance = clamp(ctx.distance - plan.postMoveDirection * dist, 0, 6)
    }
}
````

### 2.6.5 攻击范围

距离用连续值 0-6 追踪，每整数档约 2 米：

```
  0 ─── 1 ─── 2 ─── 3 ─── 4 ─── 5 ─── 6
  贴身   拳掌   刀剑   长枪   暗器   中距   远距
                 大刀          御物    御物
```

| 类型      | 攻击范围 | 最佳距离 |
| --------- | :------: | :------: |
| 拳掌      |  [0, 2]  |    1     |
| 匕首      |  [0, 2]  |    1     |
| 刀剑      |  [1, 3]  |    2     |
| 长枪/大刀 |  [2, 4]  |    3     |
| 暗器      |  [2, 5]  |    4     |
| 御物      |  [3, 6]  |    4     |

### 2.6.6 出手判定

```ts
function canAttack(weaponType: string, action: ActionDefinition, distance: number): boolean {
    const [min, max] = WEAPON_RANGE[weaponType]
    return distance >= min && distance <= max
}

// 另外检查 AP 是否够：
function canAfford(turnAP: number, action: ActionDefinition): boolean {
    return turnAP >= action.actionCost
}
```

### 2.6.7 典型博弈场景

**场景：长枪(身法60) vs 拳套(身法120)，初始距离 4**

```
回合1 - 长枪方 (距离4，范围内 ✅，10AP)
  崩拳 6AP → 余 4AP → 后移 4AP (4×0.6=2.4档)
  距离变为 4+2.4=6（边界）← 把拳套逼到最远

回合1 - 拳套方 (距离6，范围外 ❌，10AP)
  前移全部 10AP (10×1.2=12档，但到0为止)
  距离变为 0（贴身）✅ ← 身法高，一口气冲脸

回合2 - 长枪方 (距离0，范围外 ❌！长枪贴身打不了，10AP)
  必须先后退！后移 4AP (4×0.6=2.4档) → 距离 2.4
  崩拳 6AP → 回到了最佳距离附近 ✅
  余 0AP

回合2 - 拳套方 (距离2.4，范围内 ✅，10AP)
  正拳 3AP → 余 7AP → 前移 7AP (7×1.2=8.4档，但到0)
  距离 0 ← 又贴回去了
```

> 高身法(120)的拳套可以一回合冲过全场，低身法(60)的长枪逃不掉。身法的价值在 AP 系统中被极度放大。

### 2.6.8 场地边界与距离修正

```
场地总宽 = 6 档
最小距离 = 0，最大距离 = 6
超出边界的移动被截断（clamp）
```

距离对命中和伤害的双重修正：

```
距离差(实际-最佳) → 命中修正 → 伤害修正
      0           →   1.00    →   1.00
      1           →   0.85    →   0.80
      2           →   0.65    →   0.50
     ≥3           →   0.40    →   0.20
  无法出手(范围外) →    —     →    —
```

### 2.6.9 AI 决策策略

```ts
function decideTurnPlan(self: Character, enemy: Character): TurnPlan {
    const [myMin, myMax] = WEAPON_RANGE[self.weaponType]
    const [enemyMin, enemyMax] = WEAPON_RANGE[enemy.weaponType]
    const dist = currentDistance

    // 1. 选出可用的招式（AP ≤ 10 且范围覆盖当前距离 或 移动后可覆盖）
    const viableActions = selectViableActions(self, enemy, dist)

    // 2. 对每个招式，计算最优前/后移动分配
    const plans = viableActions.map((action) => {
        const neededMove = calcNeededMove(dist, action.bestDistance, myMin, myMax)
        return allocateAP(action, neededMove, self.身法)
    })

    // 3. 按期望伤害排序，选最优
    return rankByExpectedValue(plans)[0]
}
```

---

## 2.7 效果链系统

这是《单挑》战斗的核心。标准公式产生基础伤害后，效果链系统处理连锁反应。

### 2.7.1 设计原则

- 招式本身只有少量基础伤害，主要价值在于**携带的效果**
- 功法/触发器/义体提供额外的效果触发机会
- 效果可以触发其他效果，形成链条
- 链深度有上限，防止无限循环

### 2.7.2 Effect 类型定义

```ts
interface Effect {
    id: string
    type: EffectType

    // === 伤害类 ===
    damageType?:
        | 'flat' // 固定值
        | 'percent_max_hp' // 目标最大生命%
        | 'percent_current_hp' // 目标当前生命%
        | 'stat_diff' // 属性差值伤害
    value?: number // 伤害值/百分比
    statDiff?: { myStat: AttrName; enemyStat: AttrName; coeff: number }

    // === 持续效果类 ===
    dotId?: string // 流血/中毒/灼烧
    dotValue?: number
    dotDuration?: number

    // === Buff/Debuff类 ===
    buffId?: string
    buffValue?: number
    buffDuration?: number

    // === 特殊类 ===
    healPercent?: number // 回复%生命
    dispelBuffs?: boolean // 驱散对方增益
    stealTrigger?: boolean // 偷取对方触发槽

    // === 链式触发 ===
    onResolve?: TriggerCondition // 效果结算后，检查是否触发下一个
    chainPool?: string[] // 从哪个池子随机选下一个效果
    maxChainDepth?: number // 链深度限制（默认3，全局上限5）
}
```

### 2.7.3 效果链处理流程

```ts
function resolveActionEffects(action: ActionDefinition, ctx: BattleContext, depth: number): ResolvedEffect[] {
    // 1. 收集所有待处理的效果
    const pending: Effect[] = [...action.effects]

    // 2. 检查匹配的功法被动
    for (const skill of ctx.attacker.skills) {
        if (matchCondition(skill.trigger, ctx.battleEvent)) {
            pending.push(...skill.effects)
        }
    }

    // 3. 检查匹配的触发器
    for (const trigger of ctx.attacker.triggers) {
        if (matchCondition(trigger.condition, ctx.battleEvent)) {
            pending.push(...trigger.effects)
        }
    }

    // 4. 按优先级排序执行
    pending.sort((a, b) => EFFECT_PRIORITY[a.type] - EFFECT_PRIORITY[b.type])

    const results: ResolvedEffect[] = []
    for (const effect of pending) {
        const result = executeEffect(effect, ctx)
        results.push(result)

        // 5. 检查链式触发
        if (effect.onResolve && matchCondition(effect.onResolve, ctx)) {
            if (depth < (effect.maxChainDepth ?? ctx.rules.maxChainDepth)) {
                const nextEffect = pickFromPool(effect.chainPool, ctx)
                if (nextEffect) {
                    results.push(...resolveActionEffects({ ...action, effects: [nextEffect] }, ctx, depth + 1))
                }
            }
        }
    }

    return results
}
```

### 2.7.4 效果优先级

```ts
// 同一批次内效果的执行顺序
const EFFECT_PRIORITY: Record<EffectType, number> = {
    dispel: 1, // 先驱散
    buff: 2, // 再上buff/debuff
    debuff: 2,
    dot_apply: 3, // 再上dot
    heal: 4, // 治疗
    shield: 4,
    damage: 5, // 最后造成伤害
}
```

### 2.7.5 全局链深度限制

```ts
// 防止无限循环
全局默认 maxChainDepth = 3
全局硬上限 = 5（极少功法可达）

// 每次链式触发 depth+1，达到上限后停止
```

### 2.7.6 伤害汇总

```ts
// 一个招式/回合的最终伤害
totalDamage = 标准公式伤害(2.5)
            + Σ(效果链中所有 damage 类型的效果值)
            + Σ(效果链中所有 percent_max_hp/percent_current_hp/stat_diff)
```

---

## 2.8 事件驱动战斗引擎

### 2.8.1 战斗生命周期

```
BATTLE_START
  ├─ 初始化双方角色
  ├─ 初始化距离
  ├─ 初始化事件队列
  └─ 广播 battle_start 事件

BATTLE_RUNNING
  ├─ 循环处理事件队列
  │   ├─ turn_start (每回合)
  │   │   ├─ DotSystem: 中毒/灼烧独立计时
  │   │   ├─ 御物系统: 暗器修复/激活
  │   │   ├─ TriggerSystem: 扫描"回合开始"类触发器
  │   │   └─ Broadcast: turn_start
  │   ├─ plan_phase (AP 分配)
  │   │   ├─ AI 选出 TurnPlan: {前移动AP, 招式, 后移动AP}
  │   │   └─ 前移动AP + 招式cost + 后移动AP ≤ 10
  │   ├─ pre_move (前移动)
  │   ├─ action_phase
  │   │   ├─ 距离检查 (第0层：能否出手？)
  │   │   ├─ 前摇 (preDelay)
  │   │   ├─ 命中判定 (第1层)
  │   │   ├─ 招架判定 (第2层)
  │   │   ├─ 伤害计算 (第3层)
  │   │   ├─ 效果链处理
  │   │   └─ 硬直 (stunTime)
  │   ├─ post_move (后移动)
  │   └─ turn_end
  │       ├─ Buff 衰减
  │       └─ 检查胜负条件

BATTLE_END
  ├─ 判定胜负
  ├─ 结算奖励
  └─ 广播 battle_end 事件
```

### 2.8.2 事件队列

```ts
class EventQueue {
    // 按时间戳排序的优先队列
    private queue: BattleEvent[]

    push(event: BattleEvent, delayMs: number): void {
        event.timestamp = this.currentTime + delayMs
        // 插入并按时间排序
        this.queue.push(event)
        this.queue.sort((a, b) => a.timestamp - b.timestamp)
    }

    next(): BattleEvent | null {
        const event = this.queue.shift()
        if (event) this.currentTime = event.timestamp
        return event
    }
}
```

### 2.8.3 回合间隔（身法 + 衰减曲线）

```ts
// 身法影响"距离下次自己回合还有多久"
// 采用衰减曲线，防止极端差距

nextTurnInterval = 600 + 60000 / (100 + 身法) // ms

// 身法 10  → 1145ms (极慢)
// 身法 30  → 1062ms
// 身法 50  → 1000ms (基准)
// 身法 80  → 933ms
// 身法 100 → 900ms
// 身法 150 → 840ms
// 身法 200 → 800ms (极限仅比基准快 20%)

// 正常流程差距：身法30 vs 150 → 1.26x
// 极限差距：身法10 vs 200 → 1.43x
// 不会超过 1.5 倍
```

> **注意**：身法同时影响回合间隔和移动效率（每AP移动距离），两者叠加后的身法价值已经很高，不需要激进的回合速度差异。

### 2.8.4 回合操控效果

某些功法/招式可以操控对方的回合时机，形成"控制 + 大招"打法：

```ts
// 回合操控类效果
interface TurnManipulation {
    type:
        | 'stun' // 眩晕：跳过对方下 N 个回合
        | 'slow' // 减速：对方下次回合间隔 ×1.5
        | 'delay' // 推迟：对方下次回合 +N ms
        | 'interrupt' // 打断：对方当前前摇被打断，退回 turn_start
        | 'haste' // 加速：自己下次回合间隔 ×0.7
}

// 典型 combo：
//   减速(slow) 对方 → 自己连动 2 回合 → 第2回合放大招(9AP,高伤)
//   眩晕(stun) → 白打 1-2 回合 → 安全输出
```

回合操控效果在效果链中处理（详见 2.8.5 触发器系统）。

---

### 2.8.5 触发器在战斗中的角色

触发器是战斗的"被动反应层"。它们**在任意时刻**都能触发——不限于固定阶段，而是监听 EventBus 上发生的任何事件，条件匹配时自动响应。

```
EventBus 每次广播事件
  │
  ▼
TriggerSystem 扫描所有已装备触发器
  │  条件匹配？
  ├── 否 → 忽略
  └── 是 → 插入效果到 EventQueue（或立即执行）
            │
            ▼
          效果链处理（可继续触发其他触发器）
```

**触发时机示例——任意时刻：**

| 时机            | 事件                  | 触发器示例                                      |
| --------------- | --------------------- | ----------------------------------------------- |
| 🩸 受伤         | `after_damage`        | 「以血还血」：受伤时回复 30% 所受伤害的 HP      |
| 🏃 距离         | `turn_start`          | 「缩地成寸」：敌方距离 ≤ 1 时，自动瞬移到距离 4 |
| 💫 被控         | `on_debuff_applied`   | 「钢筋铁骨」：被眩晕时自动解控，冷却 3 回合     |
| ⚡ 被闪避       | `on_enemy_dodge`      | 「燕返」：自己的攻击被闪避后，追加一次必中反击  |
| 💀 击杀         | `on_kill`             | 「嗜血」：击杀敌人回复 20% HP                   |
| 👁️ 敌方出招     | `before_enemy_action` | 「看破」：有概率打断对方前摇                    |
| 🩸 被上流血     | `on_dot_applied`      | 「凝血术」：清除流血，回复等量 HP               |
| 🛡️ 招架成功     | `on_parry`            | 「借力打力」：将减免的伤害反弹给对方            |
| ❤️ 低血量       | `on_hp_threshold`     | 「浴血」：HP 低于 30% 时增伤 30%，持续 2 回合   |
| 🔄 自己回合开始 | `own_turn_start`      | 「蓄势待发」：每回合 +5% 暴击率，可叠加         |

**触发槽是核心限制：**

```ts
// 初始触发槽数 = 悟性 / 20 (向下取整，最少 1 个)
triggerSlots = Math.max(1, Math.floor(悟性 / 20))

// 每个触发器占用 1 个槽
// 槽数有限 → 必须选择带哪些触发器
```

| 悟性 | 槽数 | 策略                    |
| :--: | :--: | ----------------------- |
|  20  |  1   | 只能带 1 个，选最核心的 |
|  60  |  3   | 攻防各 1 + 1 灵活位     |
| 100  |  5   | 可以构建触发器链        |
| 150+ |  7+  | 全自动反应机器          |

> 特殊事件/节点可获得额外触发槽。触发器完整设计见第 4 章。

---

## 2.9 Dot 系统

### 2.9.1 两类 Dot

| 类型     | 触发方式         | 示例                                     |
| -------- | ---------------- | ---------------------------------------- |
| 独立计时 | 固定间隔自动触发 | 中毒：每 2 秒扣血一次                    |
| 事件触发 | 绑定到特定事件   | 流血：每次行动和被攻击时触发，闪避也触发 |

### 2.9.2 流血 Dot（特殊机制）

```ts
// 流血不按固定时间触发
// 而是在以下时机触发：
流血触发条件:
  - 目标执行 action → 触发流血伤害
  - 目标被攻击 → 触发流血伤害
  - 目标闪避攻击 → 仍然触发流血伤害！

// 流血层数越高，每次触发伤害越高
bleedDamage = 流血层数 × 1
// 每次触发后，流血层数 -1

// 中毒每 2s 触发的伤害
poisonDamage = 中毒层数
```

---

## 2.10 前摇与硬直

```ts
interface ActionTiming {
    preDelay: number // 前摇时间 (ms)，此期间可被打断
    stunTime: number // 硬直时间 (ms)，执行后不可行动
}

// 前摇期间：
// - 角色处于"准备"状态
// - 对方如果触发特定效果（如"看破"），可打断并反制

// 硬直期间：
// - 角色无法执行任何行动
// - 但其他系统（dot、buff衰减）照常运行
// - 事件队列中的事件继续处理
```

### 2.10.1 控制类效果递减（Diminishing Returns）

借鉴 WoW 的 DR 机制，防止无限控：

```ts
// 每个角色按 CC 类型独立追踪
// DR 追踪：游戏时间 2 分钟内，同一类型 CC 效果递减

const DR_WINDOW = 120000 // 2 分钟（游戏内时间）

interface DRTracker {
    stun: number[] // 眩晕时间戳列表
    knockback: number[] // 击退时间戳列表
    slow: number[] // 减速时间戳列表
    preDelay: number[] // 前摇增加时间戳列表
}

// 递减阶梯
const DR_STEPS = [1.0, 0.5, 0.25, 0] // 100% → 50% → 25% → 免疫

function getDRMultiplier(tracker: number[], type: string): number {
    const now = currentGameTime
    // 清理 2 分钟前的记录
    const recent = tracker.filter((t) => now - t < DR_WINDOW)
    const step = Math.min(recent.length, 3)
    return DR_STEPS[step]
}
```

各 CC 类型的递减效果：

| CC 类型             |   100% 效果   |      50% 效果       |   25% 效果   | 免疫 |
| ------------------- | :-----------: | :-----------------: | :----------: | :--: |
| 眩晕(stun)          |  跳过 1 回合  | 跳过 0 回合(仅延迟) | 仅延迟 500ms |  ✅  |
| 击退(knockback)     |  击退 2 档 →  |      击退 1 档      | 击退 0.5 档  |  ✅  |
| 减速(slow)          | 回合间隔 ×1.5 |        ×1.25        |     ×1.1     |  ✅  |
| 前摇增加(preDelay+) |    +300ms     |       +150ms        |    +75ms     |  ✅  |

> 对于招式自带的前摇增加效果（如 点穴 附加的「气滞」），按单次效果计入 DR 判定，不按层数。即「气滞」效果本身触发一次 DR 判定，不累计。

---

## 2.11 战斗状态机

```
          ┌─────────┐
          │  INIT   │
          └────┬────┘
               │ battle_start
               ▼
     ┌─────────────────┐
     │  IN_BATTLE       │◄──────────────────────┐
     │  ┌─────────────┐ │                       │
     │  │ TURN_START  │ │                       │
     │  └──────┬──────┘ │                       │
     │         │         │                       │
     │  ┌──────▼──────┐ │                       │
     │  │ MOVE_ADJUST│ │ (移动调整距离)          │
     │  └──────┬──────┘ │                       │
     │         │         │                       │
     │  ┌──────▼──────┐ │                       │
     │  │ PRE_DELAY   │ │ (前摇)                 │
     │  └──────┬──────┘ │                       │
     │         │         │                       │
     │  ┌──────▼──────┐ │                       │
     │  │ HIT_CHECK   │ │ (命中判定 - 第1层)     │
     │  └──────┬──────┘ │                       │
     │    MISS │ HIT    │                       │
     │  ┌──────▼──────┐ │                       │
     │  │ ON_DODGE    │─┼─ 闪避(流血仍触发) ────┘
     │  └─────────────┘ │                       │
     │  ┌──────▼──────┐ │                       │
     │  │ PARRY_CHECK │ │ (招架判定 - 第2层)     │
     │  └──────┬──────┘ │                       │
     │         │         │                       │
     │  ┌──────▼──────┐ │                       │
     │  │ DAMAGE_CALC │ │ (伤害计算 - 第3层)     │
     │  └──────┬──────┘ │                       │
     │         │         │                       │
     │  ┌──────▼──────┐ │                       │
     │  │ EFFECT_CHAIN│ │ (效果链)               │
     │  └──────┬──────┘ │                       │
     │         │         │                       │
     │  ┌──────▼──────┐ │                       │
     │  │ STUN        │ │ (硬直)                 │
     │  └──────┬──────┘ │                       │
     │         │         │                       │
     │  ┌──────▼──────┐ │                       │
     │  │ TURN_END    │─┼─ 检查继续/结束 ────────┘
     │  └─────────────┘ │
     └────────┬────────┘
              │ battle_end
              ▼
     ┌──────────────┐
     │  RESULT      │
     │  (win/lose)  │
     └──────────────┘
```

---

## 2.12 一回合完整流程（AP + 三层防御）

```ts
function processTurn(attacker: Character, defender: Character): TurnResult {
  // 1. turn_start 事件
  emitEvent('turn_start', { attacker, defender })

  // 2. AI 决定 TurnPlan：{ preMoveAP, action, postMoveAP }
  const plan = attacker.ai.decideTurnPlan(defender)
  // 例：{ preMoveAP: 2, action: 正拳(cost:3), postMoveAP: 5 }  → 2+3+5=10 ✅

  // ===== 3. 前移动 =====
  if (plan.preMoveAP > 0) {
    const moveDist = plan.preMoveAP * (attacker.身法 / 100)
    currentDistance = clamp(currentDistance + plan.preMoveDirection * moveDist, 0, 6)
  }

  // ===== 第0层：距离检查 =====
  if (!canAttack(attacker.weaponType, plan.action, currentDistance)) {
    emitEvent('out_of_range', { attacker, action: plan.action, distance: currentDistance })
    // 仍可执行后移动
    if (plan.postMoveAP > 0) { applyPostMove(plan, attacker) }
    emitEvent('turn_end', { attacker, defender })
    return { type: 'out_of_range', damage: 0 }
  }

  // 4. 前摇
  sleep(plan.action.preDelay)

  // ===== 第1层：命中判定 =====
  const accuracy = calcAccuracy(attacker, defender, plan.action, currentDistance)
  if (Math.random() > accuracy) {
    emitEvent('on_dodge', { attacker, defender, action: plan.action })
    processBleedDot(defender)
    sleep(plan.action.stunTime)
    emitEvent('turn_end', { attacker, defender })
    return { type: 'miss', damage: 0 }
  }

  // ===== 第2层：招架判定 =====
  const parry = checkParry(attacker, defender, plan.action)

  // ===== 第3层：伤害计算 =====
  const formulaDmg = calcDamage(attacker, defender, plan.action, currentDistance, parry)
  const chainResult = resolveActionEffects(plan.action, ctx, depth: 0)
  const totalDmg = formulaDmg + chainResult.totalDamage
  applyDamage(defender, totalDmg)

  // 5. 硬直
  sleep(plan.action.stunTime)

  // ===== 6. 后移动 =====
  if (plan.postMoveAP > 0) {
    const moveDist = plan.postMoveAP * (attacker.身法 / 100)
    currentDistance = clamp(currentDistance + plan.postMoveDirection * moveDist, 0, 6)
  }

  // 7. turn_end
  emitEvent('turn_end', { attacker, defender })

  return {
    type: parry.parried ? 'parried_hit' : 'hit',
    damage: totalDmg,
    effects: chainResult.effects,
  }
}
```
