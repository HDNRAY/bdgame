# 属性加成改成 buff 实现 — 设计

日期：2026-09-18
状态：待实现
范围口径（用户定）：「这个阶段唯一的诉求就是把属性加成改成 buff 实现，并且没有 bug；武器这类顺手好改的一起改，不好改可以放一下，但有 bug 一定要改。」

## 1. 目标

1. 删掉 `stat_buff` 这个 effect handler，属性加成一律用 BuffDef 实现。
2. 顺带删掉 `on_equip` / `battle_start` 两个**触发条件**（作为"源自带效果"的载体），源的顶层 `effects:[add_buff]` 成为唯一写法。
3. 属性修正只有一个真相：**有序条目从 base 回放**。删掉全部逆运算（`revertBuffMods` / clamp 记账 / `revertWeaponStatBuffs` / 偷取时的反函数）。
4. 修掉现存三个 bug（见 §3）。

不做（下一阶段）：
- 153 处"纯行为" `on_equip`/`battle_start` 触发器的迁移（它们不涉及属性，迁移无功能收益）。
- 因此 `battle_start` 作为**玩家可选触发条件**与 `on_equip` 事件名暂时都在；等那 153 处迁完再一起删。

## 2. 数据写法（目标态）

```ts
{
  id: 'titanium_arm',
  effects: [
    { type: 'add_buff', buffId: 'titanium_arm_buff' },        // 源自带 buff：构造期挂上
    { type: 'max_ap_mod', value: -1 },                        // 仍是账 op（见 §4）
  ],
}
```

`BuffDef`：

```ts
{
  id: 'titanium_arm_buff',
  name: '钛合金手臂',
  attrMods: { strength: 2, dexterity: 2 },   // ← 属性加成在这里，不再有 stat_buff
  maxApMod: -1,                              // ← 每层 AP 上限修正（类型已有）
  expiry: { type: 'permanent' },
  hidden: true,                              // 纯属性 buff 不进战斗界面 buff 列表
}
```

规则：
- 源的顶层 `effects` 与触发器里的 `add_buff` **语义相同**（都是"挂一个 buff"）；顶层 = 构造期挂（属性立刻生效），触发器 = 事件驱动。
- 附着 buff 的 `attrMods × stacks` + `maxApMod` 折进来源层账 → 构筑面板、触发槽上限、开局血量、武器 `requireAttrsMin` 门槛全部照旧在构造期就算对。
- 纯属性附着 buff（只有 `attrMods`/`maxApMod`，无 hooks）标 `hidden`，目的是保持现在的观感：账上的属性加成今天不进 buff 列表。有 hooks 的照旧显示。

## 3. 现存 bug（都要修）

| # | 现象 | 实测 |
| --- | --- | --- |
| 1 | 战斗期 buff 的属性贡献被来源层重算抹掉，层里的 `mods` 还在 → 到期再扣一次 | 内劲 +3 力道：13 → 重算后 10 → 层移除后 **7**（扣两次） |
| 2 | 汲取对目标的永久扣减没有账，任何一次重算都会还回去 | 对方 9 → 汲取 3 点 6 → 重算后 **9** |
| 3 | `switch_weapon` 用逆运算改属性、不动来源层账 → 账说旧武器、`weaponDef` 说新武器，之后任何重算（探云手即触发）悄悄回滚换武 | 换武后 11/11/12、账 `weapon:bare_hands`；重算后 10/10/10、`weaponDef` 回到 `bare_hands` |

触发点：探云手偷奇物（全库唯一战斗中 `removeSource`）、换武。`addSource` 只在构建期。

## 4. 设计

### 4.1 属性账：有序条目从 base 回放

`rebuild(char, state?)`：

```
attrs = base
回放 来源层条目（按层序，层内按 ops 序）：mod / convert / restriction / max_ap_mod
回放 战斗层条目（按层创建序，存「请求值」而非「生效值」）
```

- 战斗层条目的来源就是 `pendingBuffs` 里该角色的层（`layersOf(char, state)` 合并读视图已是这个形状）；构造期没有 state，就只回放来源层。
- 因此战斗中每次属性写入都必须留层：内劲 buff、超越（按**乘**记 factor）、汲取（自己一条、**对方一条**）、眩晕、换武。
- 不记"实际生效量"：一旦上下文变了（来源增减、战斗层加减），被上限夹住后冻结的 `applied` 就再也对不上 —— 实测反例：base 9，来源 A +10（applied 10）、B +20（被夹，applied 11），力道 30；撤 A 若按增量平移 = 30−10 = **20**，正确是 29，漂 9 点。这就是棘轮。回放不带这个毛病。
- 由此删掉：`revertBuffMods`、clamp 记账（`partialRevertMods` 一类）、`revertWeaponStatBuffs`、偷取时的 `max_ap_mod` 反函数。删层 = 删条目 + 重算。

### 4.2 附着 buff 物化

- 开局（`BattleEngine` 构造）：对双方每个来源层里的附着 buff，走标准 `add_buff` 路径建战斗层，层上打 `originId = 源id`；因为属性已由来源层账负责，物化时**不重复应用属性**（层标 `attrsInLedger`，跳过 `attrMods`/`maxApMod`）。
- 换装 / 被偷到手：`addSource(..., engine)` 在战斗中挂来源时同样物化。
- 撤源（`removeSource`）：删账条目 + 按 `originId` 删掉它物化的层 + 重算。`steal_artifact` 里扫 `grantedBuffs`、`tagOrigin` 认领、`max_ap_mod` 反函数全部删除。
- 走标准 `add_buff` 路径是为了保住 stacking 语义：同一 buffId 多来源仍按 `additive` 合并（例：超载）。

### 4.3 hook

只加一个：`onActivate(ctx)` —— 附着 buff 物化成战斗层时触发（恒有 engine/state）。唯一用例是 `passive:iaijutsu_mastery` 的 `battle_start → actionId: _iaijutsu_ready`（166 个槽里唯一不是 add_buff/max_ap_mod 的效果，`attrMods` 表达不了）。改法：挂一个隐藏 buff，`onActivate` 里触发那招。名字可改。

### 4.4 武器（顺手 + bug 3 必须改）

`switch_weapon` 重写为：

```
removeSource(`weapon:${old}`)          // 撤账 + 撤附着层
currentWeaponId = newId                 // weaponDef 由 derivedWeaponDef() 派生，不再手写
addSource(`weapon:${new}`, 'weapon', weapon.effects, ['weapon'])
weaponDef = derivedWeaponDef()
物化新武器的附着 buff；emit('on_weapon_change')
```

`passiveTriggers` / `grantsActions` 的手工增量维护**先留着**（现在没测出 bug），但新路径里把 splice 与 `addSource`/`removeSource` 放同一处，不扩散。

## 5. 迁移清单

- `stat_buff` 站点 32 个：
  - 可并入该源**已有的专属** buff（8）：`muscle_boost→muscle_degradation`、`frog_gall→poison_resist`、`pu_ti_zhu→pu_ti_zhu_buff`、`combat_armor→combat_armor_def`、`spirit_resonance→spirit_resonance_buff`、`enhanced_vision→enhanced_vision_buff`、`no_light_wisdom→no_light_buff`、`iron_back_hand→iron_back_buff`。
  - 需新开 buff（24）：其余（`titanium_arm`、`mechanical_eye`、`nano_metal_heart`、`synthetic_lung`、`neural_net`、`combat_chip`、`cochlear_implant`、`doctor_chip`、`pu_ti_tou_huan`、`wisdom_talisman`、`other_mountain`、`snake_gall`、`fiery_eyes`、`iron_mask`、`tactical_goggles`、`nano_exoskeleton`、`titanium_spine`、`dark_room_catch`、`ningqi_jue`、`sekai_heroism`、`yi_jin_jing`、`yanling_blade`、`bare_hands`、`dagger`）。名字用来源名，`hidden: true`。
  - 战斗期 2 个（`internal.ts` 3000ms 闪避、`buffs.ts` 6000ms）→ 具名 buff + `expiry:{type:'duration'}`，不隐藏。
- `on_equip`/`battle_start` 里**带属性的** 12 处 → 顶层 `effects:[add_buff]`（其中 8 处与上面并入的是同一批 buff，属性直接落在 buff 的 `attrMods` 上）。
- `max_ap_mod` 3 处 → 保持账 op（或 buff 的 `maxApMod`，实现时按哪边简单挑）。
- 删除：`stat_buff` 效果类型与 handler、`on_equip` 触发条件（数据上迁完后无使用）、`equip.ts` 的 `processOnEquipEffects`、`effectDisplay`/`triggerDisplay` 对应分支、DevMode `WeaponCompare` 里按 `on_equip` 模拟的三处（改读账）。

## 6. 平衡影响

- 11 个"构造期属性伪装成 buff"迁回构造账后，属性会重新计入面板/触发槽/血量/门槛（玄机的洞察 +4 现在就是缺的）。这批 build 数值会变，用户事后调。
- `tide_power`、`qishier_bian` 以 `stacks: 0` 挂（属性本来就没生效），账里按 0 算，行为不变。
- `src/engine/__tests__/__fixtures__/source-layer-golden.json`（316 条 build）会因来源变化需要重生成。

## 7. 测试计划

- 棘轮回归：base 9 + 来源 A(+10) + 来源 B(+20) 撤 A = 29；反复增删同一源不漂移。
- 内劲（战斗期属性 buff）在来源层重算后保持，层到期只扣一次。
- 汲取后目标触发重算不回血；汲取者自己那条正常到期回退。
- 偷奇物：双方属性/层/触发/招式精确回到各自基线（含 `max_ap_mod`）。
- 换武：换后账、`weaponDef`、属性三者一致；再触发重算不回滚。
- 物化层不重复应用属性：`attrs === base + Σ来源层 + Σ战斗层条目`。
- 316 条 golden 重生成；全量 `tsc` / `eslint` / `vitest`。

## 8. 实施步骤

- S1 属性账改回放（含战斗层条目、请求值语义），删逆运算 —— 修 bug 1/2。**已完成**
- S2 附着 buff：顶层 `add_buff` 折账 + 物化 + `originId` 撤销 + `hidden` 显示标记 + `onActivate` hook。**已完成（机制）**
- S3 数据迁移：32 处构造期 + 3 处战斗期 `stat_buff` → `add_buff`；删 `stat_buff` handler/类型。**进行中**
- S4 清死代码 + 全量验证。待办

## 9. 进度与实测（2026-09-18）

S1 + S2 机制已完成并验证：`tsc` 0 / `eslint` 0 / `src/engine/` 无 `as any` / 64 文件 576 测试通过。

| 场景 | 修复后 | 旧实现 |
| --- | --- | --- |
| 内劲 +3 → 来源层重算 → 到期 | 13 → 13 → 10 | 13 → 10 → 7 |
| 被汲取 → 对方重算 → 到期还回 | 7 → 7 → 10 | 6 → 9（提前长回来） |
| 夹取边界撤来源（base 9 + A10 + B20 撤 A） | 29 | 增量平移会得 20（漂 9 点） |
| 换武后账/weaponDef/属性 | 三者一致，重算不回滚 | 账说旧武器，重算回滚换武 |

删掉的逆运算：`revertBuffMods`、`partialRevertMods`、`revertWeaponStatBuffs`、`clearWeaponBuffLayers`、`buff-end` 的 `stat_transfer` 特例。

### 范围调整（相对 §1）
- **触发条件大迁移推迟**：`on_equip`（48 槽）+ `battle_start`（115 槽）里只有 11 处挂的 buff 自带 `attrMods`。
  把这 11 处上移到源顶层 `effects` 会让它们的属性从"开局生效"变成"构造期生效"—— 构筑面板显示值、
  触发槽上限（洞察/推演类）、开局血量都会变，属**平衡变动**且会让 316 条 golden 失效。
  因此本阶段不改它们：它们本来就已经是 buff（只是生效时刻晚一点），先保持数值不变；
  顺手改的部分是 `switch_weapon` / 缴械（bug 3）与 `steal_artifact` 的特例清理。
  等用户排平衡时再决定是否把生效时刻前移。
- `on_equip` / `battle_start` **条件本身保留**（还有 ~151 个纯行为触发槽在用），随上面那批一起删。

## 10. 重构引入的三条根因（已修，2026-09-18 复盘）

这三条是同一类错误：**把某个「构造期冻结/派生」的量改成战斗期可重算/派生后，没有同步处理旧的直接读取点与直接写入点**。都用「HEAD 基线树 + 固定种子逐事件 diff」定位，不要只看终局属性 —— 三条都会出现「终局属性完全一致、行为已经不同」的现象。

| # | 根因 | 症状 | 修法 | 验收 |
| --- | --- | --- | --- | --- |
| 1 | `rebuildDerived()` 用**活属性**重算 `#maxTriggerSlots`（HEAD 冻结在构造期） | 战斗期推演被汲取/被减 → `floor(推演/4)` 变小 → `#configTriggers.slice(0, cap)` **静默切掉**玩家配置的触发槽 → 触发招式不再执行 | 来源层回放结束后抓 `slotWisdom`，触发槽上限只认来源层（与 ctor 注释「战斗期间固定」一致） | 悟空 `wr.ts` 135/280 = HEAD；laifeng 15/20；随机数流 127 = HEAD |
| 2 | `ciyuan_init`（灵剑·附炁与刃）**直接手写派生值 `weaponDef`** | 下一次任意 `rebuildDerived()` 用 `derivedWeaponDef()` 把手写的 `qi` 标签抹掉 → `qi_amplify`（炁意）恒 no-op → 碧落剑法少 ≈+17% 伤害 | `Character.weaponPatch` + `patchWeapon()`，`derivedWeaponDef()` 叠加补丁，`setWeapon()` 换武清空（= 旧版整体覆盖语义） | 纯重构树 haoran 169/620 → **272/620 = 43.9%**（HEAD 264/620 = 42.6%）；影响面仅 haoran/ajiu（全库只有他俩带 `spirit_sword`） |
| 3 | 战斗期属性写入的**副作用**与**概率限制器**在重算路径上丢失/重放 | ① 七十二变轮体质不再按“根骨↑回血”口径回血；② 概率限制器（50% 挡推演降低）每次重算重新掷骰 → 属性与随机数流双分叉 | ① `setLayerMods`/`dropBuffLayer` 补 `applyAttrChangeSideEffects`（根骨↑回血、上限掉按比例掉血、推演变化通知回炁）；② 限制器只在**真正施加**时掷一次，层里存“过了限制器的请求值”，回放不再过限制器 | 内劲 13→13→10（旧：13→10→7）；汲取 7→7→10（旧：6→9） |

配套：`dropBuffLayerQuiet`（被汲取方的配对账到期时不播报、不跑血量/回炁副作用 —— HEAD 对目标的还原是直写 `attrs.modify`，多一次 `notifyRegenChanged` 就会让随机数从 127 变 125）。

### 同类隐患的封闭检查（已做）
- `grep -rn "weaponDef\s*=" src/engine src/data` → 除 `this.weaponDef = this.derivedWeaponDef()` 外**无**手写。
- `#configTriggers` / `offhandDef` 只在构造期赋值；`#actionCache` 由来源驱动增删；`buffDurationCallbacks` / `statRestrictionChecks` / `triggerSlotMod` / `maxHpMod` / `weaponDef` 全部由**来源层**派生。
- 唯一已知未进账项：`max_ap_mod` 仍 `self.maxApMod += e.value`（不会重现本类 bug，但换武/on_equip 重入可能重复累加）。

## 11. 待决策：剩下的触发槽迁移（166 处 `add_buff`）

现状：`on_equip` 50 槽 / `battle_start` 109 槽，合计 **166 个 `add_buff` 效果**。

| 类别 | 处数 | 迁到顶层 `effects:[add_buff]` 的影响 |
| --- | --- | --- |
| 带钩子（无 `attrMods`） | 132 | 行为等价（同一时刻建同一层、同批钩子）；唯一可观测差异是 t=0 建层/日志顺序 |
| 纯行为（无钩子无属性） | 24 | 同上 |
| `actionId` 型（居合 `_iaijutsu_ready`） | 1 | 用 `BuffDef.onActivate` 承载 |
| **带 `attrMods`** | **10** | **会影响平衡，实测不建议直接迁**（见下） |

带 `attrMods` 的 10 处：`titanium_arm`/`hydraulic_leg` 的 overload、`muscle_boost` 的失感、`floating_eye`、`wheelchair_lightness`、`forge`、`one_arm`、`tide_inner_power`、`lingxi_finger`、`autumn_water`。

**实测影响**（隔离树里把这 10 处迁到顶层，同一批数据、只有生效时机不同；32 角色 × 31 对手 × 12 seeds = 372 场/角色）：

- 多数角色 ±0~4 场；**ot su 56.7% → 34.9%（−21 场）、yangguo 54.8% → 39.2%（−15 场）**；总绝对差 80 场。
- golden：**14 条 build** 的 attrs 变化（阿九另有 maxHp/maxAp）。

三条机制：
1. 构造期属性变化 → 武器/功法 `requireAttrsMin` 门槛、`#maxTriggerSlots`、开局 `hp/maxAp` 跟着变；
2. `stat_restriction` 的交互位置变化（属性落在限制器注册之前/之后不同）；
3. **随机数流位移**：HEAD 那次开局施加会走带概率的限制器（掷骰）+ `notifyRegenChanged`，提前到构造期后调用时刻/次数改变 → 主战斗随机流整体平移 → 终局六维/血量/层数完全一致但胜负不同（实证：`yangguo vs qilan` battle_start 快照逐字段相同）。

结论：**要迁这 10 处，必须连平衡一起重调并重生成 golden**；建议它们保留触发器。

## 12. 已知无害残留：t=0 附着 buff 物化顺序

`materializeAttached()` 按 `sourceLayers` 序物化，HEAD 是按「来源注册序 + 源内声明序」在 `battle_start` emit 与 `processOnEquipEffects` 两个相位里创建，因此 t=0 的「获得状态」日志顺序不同（`chanzi`/`yidao`/`laifeng`/`orange` 各 1 处，共 8 行）。

- 已证明**无行为影响**：把物化迭代整体反序重跑 14 个对手，随机数消耗与胜者**全不变**。
- 迁移面只有 7 个源（`enhanced_vision`/`no_light_wisdom`/`spirit_resonance` 被动 + `combat_armor`/`frog_gall`/`pu_ti_zhu` 奇物 = 6 个 `battle_start`；`iron_back_hand` 武器 = 1 个 `on_equip`），且各自都是该源唯一的 trigger。
- 要归零需在迁移时记录 phase + 源内位置，并在 `#processEmit` 内按注册序交错物化 —— 为 8 行日志顺序改 trigger 管道，收益为零、风险非零，暂不做。

## 13. 全量迁移落地（2026-09-18，已完成）

把源里剩下 `on_equip` / `battle_start` 触发器的 buff 载体**全部**迁到顶层 `effects:[add_buff]`：

- 规模：**225 源 / 159 槽 / 166 个 `add_buff`**；整槽删除 **155**、保留 **4**（`golden_light` + `power_furnace`/`fen_shen_qiu` 两个 `max_ap_mod` 槽 + `iaijutsu_mastery`）。
- 居合：`battle_start → actionId:_iaijutsu_ready` 改成隐藏 buff `iaijutsu_ready_buff` 的 `onActivate` → `engine.fireTriggerAction()`（该方法是把 `#processEmit` 的 actionId 判定**抽成私有方法后暴露**，无第二份实现）；`iaijutsu_mastery.grantsActions` 补 `_iaijutsu_ready`。
- `on_equip` 机制删除：`TriggerEvent` 联合、`equip.ts`、ctor/`addArtifact`/`switch_weapon` 调用、`triggerDisplay`、DevMode `WeaponCompare`。**`battle_start` 作为玩家可选条件保留**（表项与 `emit` 未动）；残留 `on_equip`/`attachPhase` 引用 = 0。
- 迁移中顺手修掉的三个真问题（都在 `needsRuntimeLayer`/`materializeAttached*`）：
  1. 判据不能把**非 hidden** 的 buff 当空壳 → 否则 `min_move_cost`（被 `pendingBuffs.has` 读的标记）、`sangui_yuanqi`（被 `_sangui_heal` 消耗）、`muscle_degradation`（可见减益）整条消失；
  2. 物化要带上 `max`/`stackGate`（否则开局与战斗中同一条数据不一致：2.5 层不 floor、叠层缠劲消耗丢失）；
  3. 幂等判定要用**拥有者前缀**（`buffId::自己id`，原为 `buffId::`）→ 否则双方各持同一件奇物时第二个人被跳过。

### 行为影响分解（32 角色 × 31 对手 × 12 场 = 11904 场，迁移前 vs 迁移后）
| 来源 | 份额 | 判定 |
| --- | --- | --- |
| 10 个站点属性提前到构造期 | ≈**13 场（0.11%）** | 本轮**有意**的修复（属性本就该在构造期算）；golden 36 条 build 变化逐条 = 被迁走的 `attrMods×stacks` 之和 |
| 被消耗/移除的附着 buff 属性不退（`sangui_yuanqi` 等） | ≈1 场 | **bug，已修**：`SourceOp.fromBuff` + `Character.#detachedAttached` + `dropBuffLayer` 登记 + 重新物化时清除 |
| 132 个带钩子 buff 的**层创建顺序**变化 | ≈**24 场（0.2%）** | **不是 bug**（数据/逻辑无错），是顺序敏感链（`onDealDamage`/`onTakeDamage`/`onParryPenetration`）取整差被混沌放大 |

**决定：接受 0.32% 总漂移。** 要压到 0 需记"迁移前位置"（phase + 相位内序号，可从 git 历史机械恢复）并按原序物化；`attachPhase` 本身作为**字段**没必要（曾留过死字段，已清），但"顺序影响数值"这一点成立 —— 早先"顺序是纯观感"的结论只验证了 hook-less 的隐藏层，不适用于带钩子的层。

### `hidden` 的语义收窄
`hidden` 曾同时承担"不进 buff 列表"与"不建层"两件事，导致"想显示属性 buff 就得把空壳层建回来"。现在收窄为**只表示"不进 buff 列表"**：`attachedBuffs` 记录**全部**附着 buff，`materializeAttached` 只对 `needsRuntimeLayer(def)` 为真的建层，buff 列表在遍历层之后再**从来源层账补全**"有账无层"的条目（纯展示，不建层、不打日志、零行为变化）。
