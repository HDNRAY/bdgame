# 第 4 章：触发器、事件与被动流程

---

## 4.1 触发器系统

### 4.1.1 原理

触发器监听 EventBus 事件，条件匹配时自动执行一个招式（不消耗 AP，不占用行动）。

```
引擎事件 → emit(event, self, enemy) → 遍历角色触发器
  ├─ 条件类型匹配 → matchCondition → 执行对应招式的 effects
  └─ 不匹配 → 跳过
```

### 4.1.2 触发事件（TriggerEvent）

```ts
type TriggerEvent =
    | 'on_attack' // 攻击时
    | 'on_hit' // 命中时
    | 'on_take_damage' // 受伤时
    | 'on_dodge' // 闪避时
    | 'on_parry' // 招架时
    | 'on_dodged' // 攻击被闪避时
    | 'on_parried' // 攻击被招架时
    | 'on_buff' // 获得 buff 时
    | 'on_debuff' // 获得 debuff 时
    | 'on_move' // 移动时
    | 'turn_start' // 回合开始
    | 'turn_end' // 回合结束
    | 'hp_below' // HP 低于阈值（通过 check 函数判定）
    | 'before_main' // 主招前
    | 'after_main' // 主招后
    | 'before_turn_end' // 回合结束前
    | 'battle_start' // 战斗开始
```

### 4.1.3 数据结构

```ts
interface Condition {
    type: TriggerEvent
    check?: (ctx: ConditionContext) => boolean // 额外条件判定
}

interface TriggerSlot {
    condition: Condition
    actionId: string
}

interface TriggerCondition extends Condition {
    id: string
    name: string
    description: string
    apCost?: number
    maxUses?: number
}
```

### 4.1.4 触发器来源

触发器通过两种方式获得：

1. **角色配置**：`CharacterBuild.triggers[]` — 直接配置的触发器槽
2. **被动注入**：Passive 的 `triggers` 字段 → `passiveTriggers`（不污染 build）

最终触发器列表：

```ts
get triggers(): TriggerSlot[] {
    return [...this.build.triggers, ...this.passiveTriggers]
}
```

### 4.1.5 触发流程

```
emit(event, self, enemy)
  │
  ├─ 防止递归 (isEmitting flag)
  ├─ 遍历 self.triggers
  │    ├─ condition.type !== event → 跳过
  │    ├─ matchCondition 失败 → 跳过
  │    ├─ action.maxUses 耗尽 → 跳过
  │    └─ 执行招式：
  │         ├─ target === 'self' → 直接执行 effects
  │         └─ 其他 → executeAction（含战斗判定）
  └─ 解除递归锁
```

### 4.1.6 hp_below 特殊处理

`hp_below` 在 `#finalizeAttack` 末尾主动 emit，用于被动触发器的血量阈值检测。常见用法：

- 三分归元气：HP < 30% 时触发「三分归元」，回血 30+30% 后失去属性加成

### 4.1.7 辅招 vs 触发器

辅招（Bonus）和触发器（Trigger）的区别：

|         | 辅招                          | 触发器                           |
| ------- | ----------------------------- | -------------------------------- |
| AP 消耗 | 消耗 AP                       | 不消耗 AP                        |
| 源      | build.actions 中的 bonus 招式 | build.triggers + passiveTriggers |
| 时机    | 固定 timing（before_main 等） | EventBus 事件                    |
| 执行    | `#executeBonus`               | `emit` → 直接执行 effects        |
| 条件    | `bonusTiming.type` 匹配       | `condition.type` + `check` 函数  |

---

## 4.2 事件流

### 完整战斗事件顺序

```
battle_start
  └─ 各角色 battle_start 事件

角色回合：
  turn_start → #tryBonus('turn_start')
  └─ AI 决策命令循环
       ├─ 移动 → on_move (双方)
       ├─ 攻击 → on_attack
       │    ├─ 失心判定
       │    ├─ 命中判定 → on_dodged / on_dodge
       │    ├─ 招架判定 → on_parried / on_parry
       │    └─ 命中 → on_hit
       │         ├─ #tryBonus('on_hit')
       │         ├─ #tryBonus('on_take_damage')
       │         ├─ 效果应用
       │         ├─ bleeding
       │         ├─ hp_below (双方)
       │         └─ 击杀检测
       └─ after_main → #tryBonus('after_main')
  before_turn_end → #tryBonus('before_turn_end')
  turn_end
  └─ 安排下次行动时间
```

### 系统事件

```
系统事件独立于角色回合，在 TurnManager 中插队执行：

buff_end → 反转 buff 属性修正
tick_poison → 中毒伤害 + 重新调度
tick_burn → 灼烧伤害 + 重新调度
stun_reset → 清除眩晕追踪
permanent_burn → 过热伤害 + 重新调度
```

---

## 4.3 伤害类型流程

### 中毒（Poison）

```
status(poison) 命中
  └─ pendingBuffs 记录层数
  └─ 调度 tick_poison 事件

tick_poison
  └─ 伤害 = 层数 × 2
  └─ 下次间隔 = calcPoisonTickInterval(层数)
```

### 灼烧（Burn）

```
status(burn) 命中
  └─ pendingBuffs 记录层数 + 剩余 tick 数
  └─ 调度 tick_burn 事件

tick_burn
  └─ 伤害递减（随时间衰减）
```

### 流血（Bleed）

```
status(bleed) 命中
  └─ pendingBuffs 记录层数

攻击/移动时（processBleedDamage）
  └─ 伤害 = triggerBleed(层数)
  └─ 每 5 次触发减 1 层
```

### 麻痹（Paralyze）

```
status(paralyze) 命中
  └─ 降低 AGI/INS（按有效层数 × 系数）
  └─ 固定时长 1800ms 后恢复
```

### 眩晕（Stun）

```
status(stun) 命中
  └─ 降低 AGI/INS（连续递减）
  └─ 连续 5 秒内再次眩晕 → 效果减半
  └─ 固定时长 2000ms 后恢复
```

---

## 4.4 被动触发示例

### 三分归元气

```
构造期：
  1. passiveEffectHandlers.stat_buff → STR/VIT/AGI/DEX +2
  2. triggers 注入 hp_below 条件 → _sangui_heal

战斗中 HP < 30%：
  1. #finalizeAttack 末尾 emit('hp_below')
  2. hp_below 触发 → 执行 _sangui_heal
  3. heal 效果 → 回血 30 + 30% maxHP
  4. stat_buff 效果 → STR/VIT/AGI/DEX -2（抵消被动加成）
```

### 凌波微步

```
构造期：
  1. triggers 注入 on_dodge 条件
  2. modifiers 注入 'minMoveCost'

战斗中闪避时：
  1. emit('on_dodge', self, enemy)
  2. 触发 _lingbo_insight_step → INS +1（3秒）
```
