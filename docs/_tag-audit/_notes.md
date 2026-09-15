# 汇总时的校订记录（主 agent 复核）

审计由多个子任务并行产出，汇总前对**高危/结论性判定**做了复核。以下记录复核结论，最终报告以复核后为准。

## 1. 「`sword_intent_tempering` 漏 `inherent`」（passives-a 提出）→ 依据不足，降级为「需裁定」

子任务的理由是"它引用的 buff 定义自带 `inherent`"。复核：

- `src/engine/entities/tag.ts:51`：`| 'inherent' // 特性（不可复制、不可禁用）` —— 落在 **buff** 上时语义是"不可复制/不可禁用"（同类只有 3 个 buff 这么标：`damage.ts:12`、`defense.ts:148`、`defense.ts:355`）；
- 落在**功法/奇物**上时语义是"血脉限定/特性，不进随机奖励池"（`src/game/roguelite/reward-pool.ts:89/97` 过滤的是 `PASSIVES`/`ARTIFACTS` 自身的 tags）；
- 因此"buff 标了 inherent"**不能推出**"该功法该标 inherent"。事实部分（`剑意淬体` 目前会进随机池）成立，但"是否应该"属于设计判断 → 归入「需裁定」。

## 2. 「`one_arm` / `momentum_mastery` 标 `debuff` 是错标」→ 口径已确认，**判定撤销**

原本按 RUBRIC 的「`debuff` = 只给对手」判为错标。**用户已确认：`debuff` 对对手或对自己都算**。

因此 `独臂`(one_arm) 的「无法双持」、`momentum_mastery` 的自身代价标 `debuff` **属正确**，这两条从 ⚠️ 改为 ✅（`momentum_mastery` 另有 `damage`/`buff` 归属问题，仍保留 ⚠️）。

## 3. 「`requiredTags` 是硬门槛、武器缺 tag 就永远拿不到招」→ 语义理解错误（两条 ❌ 都降级）

`requiredTags` 的判定是 **`.some()`**（"武器只要有其中**任意一个** tag 即可"），不是 `.all()`：

- `src/engine/combat/engine.ts:487`：`const hasTag = action.requiredTags.some((tag) => weaponTags.includes(tag))`
- `src/engine/calc/action-executor.ts:45`：同上（同一个语义）

据此复核：

| 子任务判定 | 复核结论 |
| --- | --- |
| weapons-a ❌「`玄铁重剑`/`素铁霸刀` 缺 `melee` → 8 个剑法招永久不可用」 | **不成立**：那些招的 `requiredTags` 是 `['pierce','melee']`，`玄铁重剑` 自带 `pierce`，`.some()` 已满足 → 可用。降级为 ⚠️「权重 4 的 `melee` 缺失会让奖励关联偏低」 |
| actions-a ❌「`玉箫剑法` `requiredTags:['melee']` → 钝器体系永远拿不到」 | **不成立**：任何带 `melee` 的武器（桃木剑、藏锋、黑云剑、千机…）都能用。真正的瑕疵是"tags 宣称 `blunt` 但门槛只要 `melee`"这种**语义不一致** → 降级为 ⚠️ |

**仍然成立的硬项（保留）**：
- `engine.ts:827` `on_melee` 由**招式自身**的 `tags.includes('melee')` 决定 → 约 20 个近战招缺 `melee` 时，被近身命中不会触发 `on_melee`（真实行为影响）；
- `polearm` 误标在 `玄铁重剑`/`素铁霸刀` 上会让 `on_polearm` 生效（真实行为影响）；
- `[...WEAPON_DB, ...STARTING_WEAPONS].filter((w) => !w.tags.includes('imperial'))`（`reward-pool.ts:112`）→ 8 把起始武器（含 `bare_hands`）确实会进随机池，与 `starting-weapons.ts:8` 的注释矛盾。

## 4. 「`polearm` 被三把非长柄武器占用（含 `黑云剑`）」（weapons 提出）→ 实际只有两把

逐把核对 `polearm` 持有者（`weapons.ts`）：`破狼竹枝`、`春翁`、`铁枪·破军`、`陨铁神珍`、`千机`、`引擎铁锤`、`镇北戟` 属真长柄；**误标的是 `玄铁重剑`(dark_iron_sword) 与 `素铁霸刀`(overlord_blade)** 两把（且两者都没有 `melee`）。

`黑云剑`(fei_jian) 的 tags 是 `['melee']`，**并未标 `polearm`** —— 子任务的这一条不成立，已剔除。


## 5. 四个 `on_*` 事件没有消费方（用户指出，已核实）→ 影响面修正

`on_melee` / `on_range` / `on_unarmed` / `on_polearm` 全项目只有**发射方与声明**，没有消费方：

- 发射：`src/engine/combat/engine.ts:827-830`
- 类型声明：`src/engine/entities/trigger.ts:42-45`
- 展示文案：`src/bridge/triggerDisplay.ts:42-45`、`78-81`
- 消费：**无** —— `src/data/` 下实体实际使用的 29 种触发条件里不含这 4 种（`grep -rn "on_melee\|on_range\|on_unarmed\|on_polearm" src/data/` 零命中）

**影响修正**：
1. 删除这 4 个事件是安全的（4 行 emit + 4 行 union + 8 行文案）。
2. 删掉后，`melee`/`polearm`/`range`/`unarmed` 的消费点只剩两个：`tagRelevance` 权重档（4）与招式 `requiredTags`。
3. 因此「招式缺 `melee` → `on_melee` 不触发」这条审计结论**失效**（该标题下的 ⚠️ 仅保留"奖励权重偏低"这一半）。

## 6. 「内部实现条目必须带 `internal`」→ 基准废止，改用 `_` 前缀（用户指出 + 胜率回归实测）

原审计基准是「`internal.ts` 里的条目必须带 `internal` 标签」，P0 照此给 13 条补标，结果把 AI 要用的招式一并剔出了主招候选（`ai/index.ts:76-80`）：

| 对手 | 基线 | 补 `internal` 后 | 回退后 |
| --- | --- | --- | --- |
| 博士·德克 | 48.9% | 31.4% | 48.6% |
| 一刀 | 55.8% | 16.9% | 55.6% |

两个挡池手段的效力并不相同：`_` 前缀只挡奖励池（全库唯一消费方是 `reward-pool.ts` 的 `_getActionPool`），`internal` 标签同时挡池**并**把招式剔出 AI 主招候选。故基准改为：

- 「AI/对手要用、玩家不该学」→ `_` 前缀；
- 「AI 与玩家都不该主动用」→ `internal`。

据此各明细报告里 ❌/⚠️ 的「补 `internal`」建议一律作废，改读为「未挡池」；实际只需 `iaijutsu_strike`、`resheath` 改名（`_iaijutsu_strike`、`_resheath`），其余 11 条本就带 `_` 前缀。执行细节见汇总文 §十二。
