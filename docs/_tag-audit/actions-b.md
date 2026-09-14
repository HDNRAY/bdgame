# 招式 · 玩家/支援/内部 tag 审计

> 只读审计，**未改动 `src/` 下任何文件**。判定口径见 [`RUBRIC.md`](RUBRIC.md)。
> 范围：`src/data/actions/player.ts`（28）、`support.ts`（33）、`internal.ts`（38）；`index.ts` 无内联 `ActionDefinition`（只有 import/合并/`getActionsByWeapon`），不计入。

## 结论摘要

- 实体数：**99**（player 28 + support 33 + internal 38；`grep -c "id: '"` 与逐条解析一致）
- **❌ 19 条 / ⚠️ 39 条 / ✅ 41 条**（player 4/15/9，support 2/18/13，internal 13/6/19）
- `internal` 漏标集中区（最高危）：`internal.ts` 38 条里**15 条无 `internal`**（该文件头注释为「内部招式（被动/天赋触发专用，不直接装备）」，同文件 artifact 授予的 `_jiu_*`/`_field_dressing`/`_detox_shot` 等都带了）。其中 13 条判 ❌：`iaijutsu_strike`、`_orb_shot`、`_huan_shot`、`_silk_shot`、`_fei_jian_shot`、`_fen_shen_shot`、`_flying_lion_roar`、`_golden_bell_swing`、`_eat_beans`、`tempest`、`_chuan_yun`、`_luo_yue`、`_sonic_wave`；`resheath`、`_detox_shot` 判 ⚠️（另有其他 tag 问题）；`_arm_explosion` 是**有意豁免**（`internal.ts:144` 注释：AI 需能经 `conditionId` 主动选用）。
- 问题归类：
  - **`internal` 漏标（最高危，13 条判 ❌，另有 2 条 ⚠️；全在 `internal.ts`）**：`internal.ts` 是「被动/天赋触发专用」文件（38 条里 23 条带 `internal`）。漏标的 15 条会被 `reward-pool` 当作普通招式。`src/game/roguelite/reward-pool.ts:104` 的 `_getActionPool()` 直接 `allMainActions`（含 `INTERNAL_ACTIONS`）且**不过滤 `internal`**，`src/game/roguelite/engine.ts:413` `_itemCandidates` 的 `passAll` 也只查 `exclude/ids/excludeTags/ap/requireTags/requiredTags`；过滤只发生在 UI 层（`RewardPicker.tsx:50`、`CharacterPanel.tsx:279`、`useBuildCharacter.ts:63`）。典型受害：`_orb_shot`(`internal.ts:160`)、`_fei_jian_shot`(:216)、`_silk_shot`(:187)、`_fen_shen_shot`(:229) 连 `trigger` 都没有 → **会作为「学招式」奖励直接发给玩家，学了也不可出现/触发，纯死奖励**。`_arm_explosion`(:144) 有明确注释说明为何不标（AI 需经 `conditionId` 主动选用），属有意豁免。
  - **`buff` 方向反标（6 条）**：`electric_yoyo`、`flash`、`bi_hai_chao_sheng_qu`、`shi_qi` 等把「给对手上异常」标成 `buff`。对照：`yufeng_needle` 只有 `add_debuff`（标 `debuff`+`paralyze`），而 `_huan_shot`/`_flying_lion_roar`/`_golden_bell_swing` 同类却不带 `buff` —— 文件内无统一口径。
  - **`buff` 少标（15 条）**：`wan_liu_gui_zong`、`jin_zhong_zhao`、`chanzi_stance`、`cang_niao_jian_fa`、`gear_hang`、`summon_haste`、`condense_shield`、`agility_steal`、`drone_paralyze`、`resheath`、`_iaijutsu_ready`、`_cangfeng_mind_eye`、`_alaya_insight`、`_qiti_awaken`、`_tai_shang_heal` 等只写 `defense`/`summon`/`trigger` 而不写 `buff`（若团队口径是「只标功能类」，这批应判 ✅，见「需裁定」2）。
  - **`chan` 口径不一致**：`chanCost > 0` 却无 `chan` 标签的有 8 条（`gear_hang` 20、`big_leap` 3、`lightning_speed` 4、`jindou` 5、`santou_liubi` 27、`chanzi_heal` 10、`chanzi_stance` 10、`deng_ping_du_shui` 2）；而 `wind_hear` 无 `chanCost` 却带 `chan`（其 buff `wind_hear_buff` 不回复缠劲，只有闪避+前移）。
  - **`damage` tag 语义漂移（3 条）**：`ru_long`、`wan_fa_gui_yi`、`tempest` 带 `damage`。`grep "'damage'" src/data/actions/*.ts` 显示 `melee/unarmed/qi` 三个文件**没有任何一条招式带 `damage`**，该 tag 在数据层只用于 buff/功法（`damage.ts` 11 处）表达「增伤」。这 3 条是「造成伤害」而非「提升输出」，按 RUBRIC §输出/防御应去掉。
  - **`requiredTags` 自洽**：全部 99 条的 `requiredTags` 并集 = `blunt imperial parry pierce polearm slash summon unarmed`，全部命中武器 tag 并集（`weapons.ts`+`starting-weapons.ts`），**无孤立 requiredTags**；`getActionsByWeapon`/`ai/index.ts:85` 的交集判定也不会出现为空。
  - **`self_damage` 判定依据**：`unarmed.ts:205` 的「铁山靠」用 `type:'self_damage'` 并标 `self_damage`；`blood_droplet`/`blood_qi_protection` 用的是 `self_hp_cost`（`handlers.ts:276` 走 `spendHp`，不广播 `self_damage` 事件，`handlers.ts:273` 只给 `self_damage` 效果打该 tag）。故二者未标 `self_damage` 与现有实现口径一致，**不计为 ❌**。

---

## 一、`player.ts`（28）

现 tags 与判定：

| 实体 | 现 tags | 判定 | 理由（引用自身 effects/description/requiredTags） | 建议 |
| --- | --- | --- | --- | --- |
| 弹指（flick） | `thrown` `stun` `qi` `range` `blunt` | ✅ | `add_debuff: stun` 与 `stun` 一致；`damage{strength .2, dexterity .1}` + `getRange 0-6` + 描述「指间弹出炁劲」支持 `thrown`/`range`/`qi` | 保持 |
| 血滴子（blood_droplet） | `qi` `unarmed` `range` `thrown` `low_hp` | ❌ | 描述「**消耗10%当前气血**」且 `effects` 首条即 `self_hp_cost{ratio:0.1}`；`functional_damage: self.hp/9` 明示伤害随残血下降（越残越弱）→ 给「自伤代价」的 `self_damage` 缺失，`low_hp` 语义相反 | 去掉 `low_hp`；补 `self_damage`（若坚持 `self_hp_cost` 不算 `self_damage`，则至少去掉 `low_hp`） |
| 银针（yin_zhen） | `pierce` `range` `thrown` | ✅ | `ignore_parry` + `piercingRatio 0.5` 与描述「精准刺穴」自洽；无元素/状态标签需求 | 保持（可补 `ignore_parry`） |
| 五芒镖（dart_throw） | `slash` `range` `thrown` | ✅ | `damage{strength .3, dexterity .1}`，`onActionHitChance +3%`，无元素 | 保持 |
| 玉蜂针（yufeng_needle） | `range` `thrown` `paralyze` `debuff` `pierce` | ✅ | `add_debuff: paralyze` + `add_debuff: poison`，描述「附寒毒麻痹」；同文件 `electric_yoyo` 的同类麻痹却不写 `paralyze`（见该条） | 保持（并以此条为口径统一 `electric_yoyo`/`drone_paralyze`） |
| 飞刀（throwing_knife） | `range` `pierce` `slash` `thrown` | ✅ | `onActionCritChance +10%` 对应描述「易出暴击」；`pierce`+`slash` 覆盖刀刃 | 保持 |
| 生死符（sheng_si_fu） | `range` `thrown` `qi` | ⚠️ | `damage{scaling:{wisdom:.5}, piercing:10}` 是穿透伤害，描述「穿透防御直击经脉」，但无 `pierce` | 补 `pierce`（可选，参考 `yin_zhen` 的 `ignore_parry` 手法） |
| 电力溜溜球（electric_yoyo） | `electric` `debuff` `qi` | ⚠️ | 描述「电力灌注」`damage{wisdom .3}` + `add_debuff: paralyze`；**给对手上麻痹是 `debuff` 不是 `buff`**（`electric` 已覆盖元素）；同文件 `yufeng_needle` 同效果标 `paralyze` 而非 `buff` | 去掉 `buff`；补 `paralyze` |
| 雷蛇（thunder_storm） | `electric` `stun` `chan` | ⚠️ | 描述「**以炁化雷**」，`chanCost: 15`，`effects` 含 `ignore_parry`（未标 `ignore_parry`）、`add_debuff: stun`（描述写「麻痹」但实际给 `stun`）；无 `qi` | 补 `qi`、`ignore_parry`；stun 是否改 paralyze 见「需裁定」 |
| 棍戳（rod_thrust） | `blunt` `polearm` | ✅ | `requiredTags ['blunt','polearm']` 与 `tags` 完全一致，`damage{strength .25, dexterity .1}` | 保持 |
| 棍劈（rod_cleave） | `blunt` `polearm` | ⚠️ | `description`「高举过顶，一棍劈下，势不可挡」动作是劈砸，收尾是钝击面，`blunt` 为借标；`requiredTags ['polearm']` 已够 | 可保留（钝击面）；若要严格按动作归类则去 `blunt`——见「需裁定」 |
| 棍挑（rod_lift） | `blunt` `polearm` | ⚠️ | 描述「破敌防势，**降低对手闪避**」，但 `effects` 只有 `damage{strength .2, dexterity .2}` + `onActionCritDamage +20%`，**没有任何降闪避/破防 debuff**——`hookNotes.critDamage` 是唯一输出点 | 描述与 effects 不一致，`debuff` 少标或描述该改；至少不因此增删 tag（见「需裁定」） |
| 横扫（rod_sweep） | `knockdown` `polearm` | ⚠️ | `add_debuff: knockdown` ✓；但同为棍系钝击（`requiredTags ['polearm']`，齐眉棍带 `blunt`），`rod_thrust`/`rod_cleave`/`stand_rod_kick` 都带 `blunt`，此条缺——同一武器族内不一致 | 补 `blunt`（与 `rod_cleave` 同口径） |
| 裂地击（fissure） | `paralyze` `ignore_parry` `unarmed` | ❌ | 描述「猛砸地面，造成冲击波」，`requiredTags: ['polearm']`（棍系），`effects = damage{strength .6} + add_debuff:paralyze + ignore_parry`，**没有任何拳脚机制**；`unarmed` 是把长柄招错挂到空手 build 方向（权重 4），会污染 `tagRelevance` 关联与构筑建议 | 去 `unarmed`；补 `blunt`/`polearm`（与同族一致） |
| 回马枪（return_spear） | `polearm` `pierce` `chan` | ⚠️ | `getRange 3-4`，描述「佯装撤退，回首一枪」，`requiredTags ['polearm']`；该招是远程投枪式但无 `range`（`range` 权重 4），会漏掉远程 build 关联 | 补 `range`——见「需裁定」 |
| 立棍踢（stand_rod_kick） | `blunt` `polearm` | ⚠️ | 描述「以棍撑地，凌空一脚」`damage{strength .2, agility .1}` + `add_debuff: knockout`，`requiredTags ['polearm']`；此条**有** `blunt`，与 `rod_sweep` 缺 `blunt` 形成同族不一致（可保留） | 保持，或与 `rod_sweep` 统一 |
| 破狼棍法（po_lang_gun_fa） | `blunt` `polearm` | ✅ | `damage{strength .4, agility .1, vitality .1, dexterity .4}` + `onActionCritChance +50%`（对应「势不可挡」），4 维缩放 | 保持 |
| 一点寒芒（yi_dian_han_mang） | `polearm` `pierce` `buff` `frost` | ✅ | `add_buff: chill_blade`（`buffs.ts:524` 叠层「伤害+8%/层」= 真增益）+ `add_debuff: frost` + `damage{strength .1, wisdom .2}`，与描述「附加寒锋与霜冻」完全对应 | 保持 |
| 如龙（ru_long） | `polearm` `pierce` `damage` `chan` | ⚠️ | `functional_damage` 按**自身非永久 BUFF 总层数**增伤（`forEachBuffOf` 计层 × wis×0.2），这是「条件增伤」而非 `add_buff`；`grep "'damage'"` 显示 `melee/unarmed/qi` 的招式无一使用 `damage`，该 tag 只用于 buff/功法 | 去掉 `damage`（或全库统一新口径） |
| 焰拳（yan_quan） | `pre_action` `buff` `chan` `burn` | ⚠️ | `target: 'self'` + `add_buff: yan_qi`（`damage.ts:328` 任何伤害 40% 概率叠 2 层灼烧）→ `buff`/`burn`/`chan`(16) 均正确；但同类自施 buff 的 `cang_niao_jian_fa`/`dao_ma_dan` 都带 `qi`，此条描述「**凝炁为焰**」却无 `qi` | 补 `qi` |
| 挥击（hammer_swing） | `blunt` `melee` | ✅ | `damage{strength .4}` + `onActionCritChance +10%`，`requiredTags ['blunt']` | 保持 |
| 雷霆一击（thunder_strike） | `blunt` `electric` | ✅ | `damage{strength .6, wisdom .4, fixed 2}` + `add_debuff: paralyze`，描述「雷霆万钧砸下，电光四溢」；无 `chanCost`（`engine_hammer` 自带 `engine_hammer_buff`/`energy_drain`） | 保持 |
| 一夜鱼龙舞（one_night_dance） | `range` `summon` `chan` | ❌ | `damage{...wisdom .28, independentHits: 5}` 是**同一武器多次独立命中**，不生成/强化召唤物；描述「御物万法」定位属御物系但缺 `imperial`（同族 `wan_fa_gui_yi` 有），`summon` 在 `tagRelevance` 是权重 2 的流派 | 补 `imperial`；`summon` 按「是否召唤机制」再定——见「需裁定」 |
| 万法归一（wan_fa_gui_yi） | `imperial` `range` `damage` `chan` | ⚠️ | `functional_damage` 按 `self.weaponDef.summon.maxCount` 与召唤物招式 `fixed + wis×scaling` 结算，`imperial`/`range`/`chan`(33) 均正确；`damage` 同上条漂移 | 去掉 `damage` |
| 碧海潮生曲（bi_hai_chao_sheng_qu） | `qi` `range` `debuff` | ⚠️ | `ignore_parry` + `damage{dexterity .2, wisdom .3}` + `add_debuff: fumble_chance_temp`；描述「**无视招架闪避**」但 effects 只有 `ignore_parry`，未标 `ignore_parry`；`debuff` 已正确（同类 `_sonic_wave` 反标成 `buff`） | 补 `ignore_parry`；描述「闪避」需与实现核对 |
| 毒素引爆（poison_detonate） | `poison` `qi` `chan` | ✅ | `functional_damage` 读 `poison::{enemy}` 层 `remainingTicks`，`totalRemaining * DMG_PER_POISON_TICK * 3.5` 并 `delete` 毒层，与描述「引爆剩余跳数并清除所有毒层」精确对应 | 保持 |
| 探云手（steal_artifact） | （无） | ⚠️ | `effects: [{type:'steal_artifact'}]`，`target:'enemy'`，`canUse` 要求对方有非 `inherent` 奇物；`target` 与判定一致，**无 tag 是合理的**（不可伤害、不可防御、不可位移） | 保持（若统一口径可标 `debuff`，但会误导） |
| 天外飞仙（tian_wai_fei_xian） | `qi` `thrown` `range` `chan` `pierce` | ⚠️ | `effects = short_dash{maxDistance:5} + damage{strength/agility/dexterity/vitality .4, wisdom .8, piercingRatio .5}`；`short_dash` 是冲近位移（`tagDisplay` 的 `move`），描述「以身为剑」却有远程 `range` + `thrown` | 补 `move`；`thrown`/`range` 与实际「冲到脸上砍」冲突——见「需裁定」 |

---

## 二、`support.ts`（33）

| 实体 | 现 tags | 判定 | 理由（引用自身 effects/description/requiredTags） | 建议 |
| --- | --- | --- | --- | --- |
| 听潮式（guard） | `buff` `defense` `post_action` `stance` | ✅ | `add_buff: guard_up`（`defense.ts:46` `onParryChance: 0.5`），描述「大幅提升招架率」；`requiredTags ['parry']` 与 buff `tags: ['defense','stance']` 自洽 | 保持（可补 `parry`） |
| 听风式（wind_hear） | `buff` `defense` `post_action` `chan` `stance` | ⚠️ | `add_buff: wind_hear_buff`（`onDodgeChance: 0.15` + 闪避后 `short_dash` 前移）= 真增益；**但 `chanCost` 未设（0），buff 也不回复缠劲**，`chan` 无对应机制（对比 `gear_hang` `chanCost: 20` 反而无 `chan`） | 去掉 `chan`；`post_action` 建议改 `pre_action`（见「需裁定」） |
| 归宗式（wan_liu_gui_zong） | `defense` `unarmed` `post_action` | ⚠️ | `add_buff: wan_liu_gui_zong`（`defense.ts:71` 完全招架远程 + 未招架则叠 `wan_liu_insight`（`dexterity +1`/层，上限 4））→ 明显是真增益却缺 `buff` | 补 `buff` |
| 无想剑（wu_xiang_jian） | `pre_action` `buff` `chan` | ✅ | `add_buff: wu_xiang`（`buffs.ts:832` 下一招暴击 +10%、暴伤 +70%），描述「一击便可定胜负」；`chanCost: 3` | 保持 |
| 血炁护体（blood_qi_protection） | `pre_action` `buff` | ❌ | `description`「**释放15%当前气血**」→ `functional_damage` 内 `self.spendHp(cost)`（注释「卖血触发 onHpChange（血战到底联动）」）；`add_buff: blood_qi_protection`（`onTakeDamage ×0.9` + `onTickHeal(=restoreValue/10)` 10 秒回复）→ 同时是 `defense`+`heal` 机制，tags 只有 `buff` | 补 `self_damage`、`defense`、`heal`——见「需裁定」 |
| 挂（gear_hang） | `buff` `pre_action` `chan` | ⚠️ | 描述「凝缠劲为内息，**消耗20缠劲**，叠一层「挡」」，`chanCost: 20`；`add_buff: gear_shift_buff`（`buffs.ts:1482` `apRegenPerSec +0.1/层`，上限 5）= 真增益 | `chan`/`buff` 正确（同条口径下 `chan` 反成漏标重灾区，见 `santou_liubi`） |
| 苍鸟诀（cang_niao_jian_fa） | `buff` `pre_action` `qi` `chan` | ⚠️ | `add_buff: cang_niao_buff`（`buffs.ts:1805` 10 秒 AP 回复 +0.4/s，buff 自身 `tags: ['buff','qi']`）；`chanCost: 10`，描述「提高内息回复速度」；**该 buff 明确是持续回复（heal 类收益）却无 `heal`/`defense`** | 补 `heal`（或 `defense`）——见「需裁定」 |
| 闪光（flash） | `debuff` `pre_action` `electric` | ⚠️ | `add_debuff: sand_blind`（`debuffs.ts:60`），描述「以炁激发强光**致盲对手**」；方向上 `debuff` 正确，但描述「以炁激发」+ `electric` 用于「强光」——`electric` 是权重 2 流派，机制上无雷伤/麻痹 | 去 `electric`（或改 `qi`）——见「需裁定」 |
| 刀马旦（dao_ma_dan） | `buff` `pre_action` `qi` `chan` | ✅ | `add_buff: dao_ma_dan`（`buffs.ts:1742` 力/身/巧 +1、AP+10%、每 2 秒回 2 血、`onRuntimeAction` 给招式加 `qi`），描述「招式带炁，回复内息与气血」逐条对应；`chanCost: 30`、`requiredTags ['polearm']` | 保持 |
| 扫描分析（scan_analysis） | `pre_action` `buff` `summon` | ⚠️ | `add_buff: scan_analysis`（`buffs.ts:1526` 每层命中 +5%、暴击 +5%，上限 5），`maxUses: 3`；`requiredTags ['imperial']` 已有 `imperial` 体系归属，但自身无 `imperial`——同族 `ling_qi_guan_zhu`/`summon_haste` 都带 | 补 `imperial`（可选） |
| 魅影步（swift_step） | `move` `pre_action` | ✅ | `dash{maxRange:3, targetDist:0}` + `add_buff: phantom_step`，描述「身随心动」 | 保持 |
| 虎跃（big_leap） | `move` `pre_action` `chan` | ⚠️ | `dash{minRange:2, maxRange:5, targetDist:0}` + `canUse 要求 strength>=10`，描述「需力道≥10」；`chanCost: 3` 且描述未提缠劲，`chan` 只有数值依据 | 保持或统一 `chan` 口径 |
| 电光石火（lightning_speed） | `move` `pre_action` `chan` | ✅ | `dash{maxRange:4, targetDist:0}`，`chanCost: 4`，描述「瞬息即至」；无元素机制，未标 `electric` 正确 | 保持 |
| 筋斗（jindou） | `move` `pre_action` `chan` | ✅ | `dash{minRange:1, maxRange:8, targetDist:1}` + `canUse agility>=10`，`chanCost: 5` | 保持 |
| 凤迴（feng_hui） | `move` `pre_action` | ✅ | `dash{maxRange:8, targetDist:0}`，描述「瞬移至对手身后」，`useAp: false` | 保持 |
| 凤反（feng_fan） | `move` `pre_action` `post_action` | ❌ | **同时带 `pre_action` 与 `post_action`**；`engine.ts:851` 用「有其中任一」放行 support 路径，`ai/index.ts:76-78` 用「有其中任一」从主招候选剔除，二者语义互斥（RUBRIC §归类与暴露：「二者与普通招式互斥的分类」）。`effects` 只有 `dash{maxRange:8, targetDist:-1}`（纯后撤） | 二选一（按「收招后拉开距离」保留 `post_action`，去 `pre_action`） |
| 云步（yun_bu） | `move` `pre_action` | ⚠️ | `dash{maxRange:4, targetDist:-1}` + `add_buff: yun_bu_foresight`（`onHitChance +0.08`，描述「下次攻击更难招架闪避」）= 真增益却无 `buff` | 补 `buff` |
| 瞬步（dian_bu） | `move` `pre_action` | ✅ | `dash{maxRange:2, targetDist:2, useAp:false}`，描述「回到最佳攻击距离」 | 保持 |
| 滚地拾刀（retrieve_blade） | `pre_action` `retrieve_weapon` | ⚠️ | `short_dash{maxDistance:3}` + `retrieve_weapon`，`canUse` 要求 `disarmed`；同文件带 `short_dash` 的触发招（`iaijutsu_strike`、`_ling_ao_chong`）都标 `move` | 补 `move` |
| 拾起兵器（pickup_weapon） | `pre_action` `retrieve_weapon` | ✅ | `retrieve_weapon` + `canUse` 判定 `dropPosition` 距离 ≤1 | 保持 |
| 三头六臂（santou_liubi） | `buff` `pre_action` `chan` | ⚠️ | `add_buff: santou_liubi`（`buffs.ts:671` 回合结束 AP 回满，`stacks: 2`），`chanCost: 27`；描述写「消耗**30**层缠劲…后续**3**个回合」与 `chanCost:27`/`stacks:2` 不一致（描述与实现漂移，tag 本身没问题） | 保持 tag；描述需修（见「需裁定」） |
| 抛沙（sand_throw） | `debuff` `pre_action` | ✅ | `add_debuff: sand_blind{stacks:2, chance:0.8}`，描述「扬沙迷眼，中距离干扰」，`getRange [1,3]`；`canUse` 防重复 | 保持 |
| 蚀炁（shi_qi） | `debuff` `post_action` `qi` `range` `chan` | ✅ | `add_debuff: weakness{stacks:3}`，描述「削弱对手气力与推演」，`chanCost: 12`、`getRange [1,5]` | 保持 |
| 灵剑（spirit_sword） | `buff` `pre_action` `qi` | ✅ | `ciyuan_init` + `add_buff: ciyuan_blade`（`onParryPenetration` 穿透 30%），描述「凝炁为刃，剑炁可穿透防御」 | 保持 |
| 御物加速（summon_haste） | `imperial` `summon` `pre_action` | ⚠️ | `add_buff: summon_haste`（`buffs.ts:315` `onSummonInterval` 缩短开火间隔，上限 4），描述「召唤物开火更快（叠1层，上限4层）」；`buff` 漏标（同族 `dao_ma_dan` 等都有） | 补 `buff` |
| 凝炁成盾（condense_shield） | `post_action` `defense` | ⚠️ | `add_buff: qi_shield{stacks:2}`（`defense.ts:10` 吸收伤害，炁招 2/其他 1）；描述「凝聚炁息化为护盾」→ `defense` 对，但 `buff` 漏标；同时「凝炁」无 `qi` | 补 `buff`（可选补 `qi`） |
| 汲灵（agility_steal） | `imperial` `summon` `pre_action` | ⚠️ | `stat_transfer{stat:'agility', value:1}`，描述「本体命中时吸取身法 1 点」；`buff`/`defense` 皆缺（属性增益），`onActionHitChance: () => 1` 已写 `hookNotes` | 补 `buff` |
| 御物麻痹（drone_paralyze） | `imperial` `summon` | ⚠️ | `add_debuff: paralyze{chance:0.35}`，描述「350%概率附加1层麻痹」；**缺 `debuff`、`paralyze`**（同文件 `yufeng_needle` 标了 `debuff`+`paralyze`，`electric_yoyo` 标了 `debuff`） | 补 `debuff`、`paralyze` |
| 灵炁灌注（ling_qi_guan_zhu） | `buff` `pre_action` `imperial` | ✅ | `add_buff: sword_enhance_buff`（`buffs.ts:1188` 4 秒伤害 +10%、命中 +5%），描述「增加命中和暴击」（buff 实际是伤害+命中，暴击少标为描述问题） | 保持 |
| 甘露（chanzi_heal） | `heal` `qi` `pre_action` `chan` | ⚠️ | `functional_heal: Math.round(self.hp*0.03)`，描述「回气疗伤」，`chanCost: 10`；`heal`/`qi`/`chan` 正确 | 保持（`chan` 口径一致性见摘要） |
| 金刚不坏（chanzi_stance） | `buff` `qi` `pre_action` `chan` | ⚠️ | `add_buff: chanzi_stance`（`defense.ts:676` `onTakeDamage` 反伤 15%），描述「受到伤害时反伤10%」（描述 10% vs 实现 15%）；机制上是**反击/反伤 + 防御**，无 `counter`/`defense` | 补 `defense`、`counter`；描述需修 |
| 金钟罩（jin_zhong_zhao） | `defense` `buff` `pre_action` | ⚠️ | `add_buff: jin_zhong_zhao`（`defense.ts:704` 吸收 45 点、免疫 `stun/knockdown/disarmed`、每 5 秒修 1），`maxUses: 1`，描述「罡气护身」；buff 自身 `tags: ['super_armor','defense']`，金钟罩是**罡体免疫硬控**，却无 `super_armor` | 补 `super_armor` |
| 登萍度水（deng_ping_du_shui） | `move` `pre_action` `chan` | ✅ | `dash{maxRange:4, targetDist:0}` + `getRange [0,12]`，描述「位移至对手身前」，`chanCost: 2` | 保持 |

---

## 三、`internal.ts`（38）

> 该文件头注释为「内部招式（被动/天赋触发专用，不直接装备）」。**判定基准 = RUBRIC §归类与暴露：内部实现条目必须带 `internal`**；`reward-pool.ts:104` 不按 `internal` 过滤，UI 才过滤（`RewardPicker.tsx:50` 等），因此漏标即等于把内部招放进「学招式」候选池。

| 实体 | 现 tags | 判定 | 理由（引用自身 effects/description/canUse/来源） | 建议 |
| --- | --- | --- | --- | --- |
| 居合斩（iaijutsu_strike） | `move` `slash` | ❌ | `canUse` 要求 `pendingBuffs.has('iaijutsu::')`，`effects = short_dash{1} + damage{strength 1.9} + remove_buff: iaijutsu`；**是 `resheath` 的姿态收招专用招，不可装备，缺 `internal`**（有 `move`/`slash` 说明位移/武器面已标注） | 补 `internal` |
| 纳刀（resheath） | `buff` `post_action` `stance` | ⚠️ | `add_buff: iaijutsu`（`buffs.ts:86` `tags:['stance']`，无 `expiry`）→ `buff`/`stance` 正确；但 `post_action` 与语义相反：`ai/support-planner.ts` 中 `post_action` 在主招**之后**执行，而本招的功能是「进入居合架势为下一击蓄势」，`canUse: hasNoStance` 也表明应在无架势时先手使用 | `post_action` → `pre_action`；补 `internal`；补 `slash`（`requiredTags ['slash']` 呼应） |
| 三分归元（_sangui_heal） | `trigger` `heal` `internal` `low_hp` | ✅ | `effects = heal{ratio:0.2} + remove_buff: sangui_yuanqi`；触发源 `passives.ts:11-22`（`hp_below < 0.3` 触发 `_sangui_heal`）；`internal`、`trigger`、`heal`、`low_hp` 全对 | 保持 |
| 炁体源流·觉醒（_qiti_awaken） | `trigger` `internal` `low_hp` | ⚠️ | 触发源 `passives.ts:346-355`（`hp_below < 0.2`）；`effects = cleanse{allDebuffs} + add_buff: qi_shield{10} + add_buff: qiti_awaken_buff + stat_buff{六维+2}` → `buff`/`defense`/`cleanse` 皆缺 | 补 `buff`、`cleanse`（可选 `defense`） |
| 居合（_iaijutsu_ready） | `trigger` `internal` | ⚠️ | `add_buff: iaijutsu`（`stance` 类），`maxUses: 1`；`trigger`/`internal` 正确但缺 `buff`/`stance` | 补 `buff`、`stance` |
| 藏锋·心眼（_cangfeng_mind_eye） | `trigger` `internal` | ⚠️ | `add_buff: mind_eye`（`buffs.ts:121` 暴击 +25%，消耗型）；缺 `buff` | 补 `buff` |
| 疾风·雷闪（_godspeed_counter） | `trigger` `electric` `counter` `internal` | ✅ | `damage{insight 0.2, piercing 1}`，`target:'enemy'`，是被动反击触发招；`counter`/`trigger`/`internal` 正确 | 保持 |
| 顺势反击（_generic_counter） | `trigger` `counter` `internal` | ✅ | 注释「通用反击（无 tag，任何武器可用）」，`damage{strength .1, dexterity .2}` | 保持 |
| 虎彻·看破（_tiger_eye_foresight） | `trigger` `internal` | ✅ | `add_buff: foresight`（招架 +30%）+ `kanchuan`（闪避 +10%），触发源 `artifacts.ts:254` `on_stance`；`trigger`/`internal` 到位（严格说可补 `buff`） | 保持 |
| 解毒（_detox） | `trigger` `internal` | ⚠️ | `effects = cleanse{buffIds:['poison']}`，`maxUses: 999`；`cleanse` tag 存在（`tag.ts:14`）却未标（同族 `_detox_shot`/`_field_dressing` 同样漏） | 补 `cleanse` |
| 自爆（_arm_explosion） | `burn` | ⚠️ | 注释 `internal.ts:144`：「**不用 internal：AI 需能通过 conditionId 主动选用（绝境招），也允许 UI 展示**」，`_arm_explosion` 经 `artifacts.ts:13` `grantsActions` + `opponents/ajiu.ts:33` `conditionId: 'hp_below_50'` 使用——**不标 `internal` 是有意为之，不应改**；但 `damage{fixed:5}` 输出面缺 `damage`/`range`（`getRange [0,5]`） | 保持 `internal` 缺失（有意豁免）；补 `damage`/`range`（可选） |
| 法珠冲击（_orb_shot） | `range` `summon` | ❌ | 来源 `starting-weapons.ts:78` `summon.actionId: '_orb_shot'`（召唤物招式），`damage{fixed:3, piercing:1}`、`getRange = 1+wis/2`；**无 `internal`、无 `trigger`，会被奖励池当普通招式发给玩家——学了也不会被推演命中（不在角色 actionConfigs 触发/装备链）** | 补 `internal` |
| 无人环撞击（_huan_shot） | `range` `blunt` `summon` | ❌ | 来源 `weapons.ts:234`（`hover_drone.summon.actionId`），`add_debuff: paralyze{0.3}`；无 `internal`，同类高危 | 补 `internal` |
| 浮游丝（_silk_shot） | `range` `pierce` `summon` | ❌ | 来源 `starting-weapons.ts:60`（御物浮游丝），`functional_damage` 按距离收紧；无 `internal` | 补 `internal` |
| 一剑西来（_fei_jian_shot） | `range` `slash` `pierce` `summon` | ❌ | 来源 `starting-weapons.ts:96`（御物飞剑），`damage{wisdom .5, fixed 5}`；无 `internal` | 补 `internal` |
| 分身攻击（_fen_shen_shot） | `summon` | ❌ | 来源 `artifacts.ts:188`（分身召唤物 `actionId`），描述「分身的攻击」，`damage{strength .1, dexterity .1}`；无 `internal`（连 `summon` 都有却漏 `internal`） | 补 `internal` |
| 飞狮吼（_flying_lion_roar） | `range` `summon` | ❌ | 来源 `artifacts.ts:175`（召唤物招式），`damage{wisdom .3}` + `add_debuff: stun{0.6}`；无 `internal` | 补 `internal` |
| 凌波微步（_lingbo_insight_step） | `trigger` `buff` `internal` | ✅ | `stat_buff{dodgeChance: 0.02, durationMs: 3000}`，触发招；`buff`/`trigger`/`internal` 齐全 | 保持 |
| 金玲索（_golden_bell_swing） | `blunt` `range` | ❌ | 来源 `artifacts.ts:418` `grantsActions: ['_golden_bell_swing']`，`damage{dexterity .4}` + `add_debuff: paralyze{1}`，`getRange [2,5]`；无 `internal`（artifact 授予但注释说「以炁御之」）且缺 `paralyze`/`debuff` | 补 `internal`、`debuff`、`paralyze` |
| 嚼茴香豆（_eat_beans） | `pre_action` `buff` | ❌ | 来源 `artifacts.ts:479` `grantsActions`，`add_buff: bean_buff`（`buffs.ts:1151` 全属性 +1，10 秒）；**与同样由 artifact 授予的 `_jiu_*` 五条（都带 `internal`）不一致** | 补 `internal` |
| 女儿红（_jiu_nv_er_hong） | `pre_action` `buff` `jiu` `internal` | ✅ | `add_buff: nv_er_hong`（每秒回 1.5 血，9 秒），`jiu` 对应酒系 artifact | 保持 |
| 霸王醉（_jiu_ba_wang_zui） | `pre_action` `buff` `jiu` `internal` | ✅ | `add_buff: ba_wang_zui`（每层每秒回 1 缠，9 秒） | 保持 |
| 竹叶青（_zhu_ye_qing） | `pre_action` `buff` `jiu` `internal` | ✅ | `add_buff: zhu_ye_qing`（每层 AP +0.3/s，9 秒） | 保持 |
| 烧刀子（_shao_dao_zi） | `pre_action` `buff` `jiu` `internal` | ✅ | `add_buff: shao_dao_zi`（每层暴击 +7%，9 秒） | 保持 |
| 不老泉（_bu_lao_quan） | `pre_action` `buff` `jiu` `internal` | ✅ | `add_buff: bu_lao_quan`（每 3 秒回 3 血，9 秒） | 保持 |
| 甩刃（_shuai_ren） | `slash` `internal` `trigger` | ✅ | 描述「断刀锁链甩出，如灵蛇出洞」，`requiredTags ['slash']`，`getRange [2,4]`；`internal`/`trigger` 到位 | 保持 |
| 发辫刃（_braid_blade） | `trigger` `slash` `pierce` `internal` | ✅ | 描述「辫中藏刃，回旋飞出」，`damage{strength .1, agility .1, dexterity .1}` | 保持 |
| 止血针（_field_dressing） | `trigger` `heal` `internal` | ⚠️ | `effects = cleanse{buffIds:['bleed'], perDebuffStacks:2}`，`maxUses: 1`；**效果是净化流血，`heal` 反而是空的**（没有 `heal` 效果），且缺 `cleanse` | 去 `heal`；补 `cleanse`（或让 `heal` 描述对应） |
| 解毒针（_detox_shot） | `trigger` `internal` | ❌ | `effects = cleanse{buffIds:['poison'], perDebuffStacks:2}`（注释明确「只解 2 层毒」），是标准净化；`tag.ts:14` 有 `cleanse`，全库却**无一条招式使用 `cleanse`**（`grep cleanse src/data/actions/*` 仅 internal.ts 命中） | 补 `cleanse`（并考虑补 `heal` 与 `_field_dressing` 统一） |
| 肾上腺素针（_adrenaline_shot） | `trigger` `buff` `internal` | ✅ | `add_buff: adrenaline_rush`（`buffs.ts:1199` AP 恢复翻倍 20 秒），`maxUses: 1` | 保持 |
| 暴雨梨花（tempest） | `pierce` `range` `thrown` `chan` | ❌ | 来源 `artifacts.ts:622`（artifact `id:'tempest'`，`tags:['inherent']`，`grantsActions:['tempest']`），`damage{wisdom .2, fixed 3, independentHits:27, piercing:2}`，`chanCost: MAX_CHAN`、`maxUses: 1`；**action 自身无 `inherent`/`internal`**，而 artifact 的 `inherent` 只挡 artifact 池（`reward-pool.ts:97`）不挡 action 池（:104），于是唐柔专属奇物的招式会作为「学招式」奖励发给玩家 | 补 `inherent`（与 artifact 对齐）或 `internal`（并在 `reward-pool` 统一过滤）——见「需裁定」 |
| 穿云（_chuan_yun） | `pierce` `polearm` `slash` | ❌ | 描述「三节枪近身缠卷，**绕过盾牌与招架**」，`effects = ignore_parry + damage`，`requiredTags ['polearm']`；**无 `internal`**（同族 `_luo_yue` 也无），且缺 `ignore_parry` | 补 `internal`、`ignore_parry` |
| 落月（_luo_yue） | `slash` `range` `polearm` | ❌ | 描述「三节枪如鞭般甩出，凌空斩下」，`getRange [3,5]`，`requiredTags ['polearm']`；无 `internal` | 补 `internal` |
| 阿赖耶识（_alaya_insight） | `trigger` `internal` | ⚠️ | `stat_transfer{stat:'insight', value:1, duration:4000}` 是属性增益，缺 `buff` | 补 `buff` |
| 泼油（_oil_splash） | `debuff` `pre_action` `internal` | ✅ | `add_debuff: oil_coating`（`debuffs.ts:245` 灼烧翻倍、身法 -2），`canUse` 防目标已浸油；`debuff`/`internal` 正确 | 保持 |
| 灵鳌冲（_ling_ao_chong） | `trigger` `internal` `unarmed` `blunt` `melee` | ✅ | 描述「闪避后借势冲向对手，撞出钝击并麻痹」，`short_dash{3}` + `damage{strength .1, agility .1, vitality .1}` + `add_debuff: paralyze{0.6}`，触发源 `passives.ts:995` `on_dodge` | 保持 |
| 音波（_sonic_wave） | `qi` `range` `debuff` | ❌ | 来源 `artifacts.ts:725` `grantsActions: ['_sonic_wave']`（人造发生器），`effects = ignore_parry + damage{wisdom .2} + add_debuff: fumble_chance_temp{2}`；**无 `internal`**，描述与「炁」无关却标 `qi` | 补 `internal`；`qi` 去掉——见「需裁定」 |
| 太上御法·回炁（_tai_shang_heal） | `trigger` `heal` `internal` | ✅ | `heal{value:1}`，注释「召唤物命中时微量回血」；`trigger`/`heal`/`internal` 齐全 | 保持 |

---

## 需裁定（拿不准的）

1. **`pre_action` / `post_action` 的语义边界**（影响 `feng_fan`、`wind_hear`、`resheath`、`_adrenaline_shot`）。引擎只用「是否带其中之一」分流（`engine.ts:851` 放行 support 路径、`ai/index.ts:76` 从主招剔除），`ai/support-planner.ts` 再把 `pre_action` 排在主招前、`post_action` 排在主招后。据此：
   - `feng_fan` 同时带两者，**任何一条路径都会重复释放**（`preCmds` 与 post 各一次）——请裁定保留哪一个；
   - `wind_hear`、`resheath` 的功能是「为下一次攻击蓄势/进入架势」，却标 `post_action`（在主招之后才执行），是否应改 `pre_action`；
   - `_adrenaline_shot`（`internal.ts:383`）无 `pre_action`，靠 `trigger` 触发消费则无影响；若要 AI 主动规划则需补。
2. **`buff` 标注到哪一层**。RUBRIC 只要求「真的给角色施加了增益状态」。同文件内有三种现成口径：
   - 只标 buff 机制（`guard`/`dao_ma_dan`/`spirit_sword`/`_eat_beans`）；
   - 只标功能类（`condense_shield` 标 `defense`、`summon_haste` 标 `summon`、`wan_liu_gui_zong` 标 `defense`、`_tai_shang_heal` 标 `heal`）；
   - 两者都标（`jin_zhong_zhao` 标 `buff`+`defense`）。
   我按「两者都标」判了 ⚠️（少标），但如果团队口径是「只标功能类」，则 `wan_liu_gui_zong`、`summon_haste`、`condense_shield`、`agility_steal`、`drone_paralyze`、`jin_zhong_zhao`、`_iaijutsu_ready`、`_cangfeng_mind_eye`、`_alaya_insight`、`_qiti_awaken` 这 10 条应改判 ✅。
3. **`chan` 到底是「消耗缠劲」还是「缠劲奖励」**。`thunder_storm`/`return_spear`/`ru_long`/`yan_quan`/`poison_detonate`/`tian_wai_fei_xian`/`shi_qi`/`big_leap`/`jindou`/`lightning_speed`/`deng_ping_du_shui` 是「消耗」；`wind_hear`（`chanCost` 0，buff 不回缠）像「奖励」；`gear_hang`/`santou_liubi`/`chanzi_heal`/`chanzi_stance` 有 `chanCost` 却无 `chan`。`tag.ts:59` 注释「缠劲（消耗缠/回复缠的奖励标签）」两种都算 → 需统一（我按「消耗即标」判了 ⚠️）。
4. **`tempest` 该不该从奖励池消失**。artifact `tempest`（`artifacts.ts:622`）是 `inherent`，但 action `tempest` 无 `inherent`/`internal`；`_getActionPool` 不查 `inherent`，所以它会进「学招式」池（唐柔的专属奇物招式被玩家随机学到）。是补 action 的 `inherent`（与 artifact 对齐）、还是给 `reward-pool` 加统一 `internal`/`inherent` 过滤，属设计裁定。
5. **`thunder_storm` 的控制类型**：描述写「麻痹」但 `add_debuff: buffId:'stun'`（`stun`=眩晕、控制更硬）。tag `stun` 与实现一致、与描述不一致——是改描述还是改 buffId？
6. **`_sonic_wave` 的 `qi`**：来源是「人造发生器」（`artifacts.ts:725`），`requiredTags: []`、无 `chanCost`、`damage{wisdom .2}`，与炁无关；但同效果的 `bi_hai_chao_sheng_qu` 标 `qi`（描述「以炁御音」）。是否按「以炁驱动」统一保留，还是去掉。
7. **`one_night_dance` 的 `summon`**：`tagRelevance.ts:19` 把 `summon` 定为权重 2 流派；本条 `effects` 无召唤机制（`independentHits: 5`），但 `requiredTags ['imperial']` 的玩家自带 `summon` 武器 tag（`hover_drone` `tags: [..., 'summon']`），标了反而与「御物 build」关联一致——保留 or 去掉？
8. **`blood_droplet` 的 `low_hp`**：`functional_damage: self.hp/9` 是在**扣除 10% 当前血后**取残血，越残伤害越低；`low_hp` 注释为「血量越低越强 / 用血换效果的奖励标签」。「用血换效果」可直接成立 → 是否保留 `low_hp`（我判 ❌ 按「越残越强」字面）。
9. **`血炁护体`/`血滴子` 的 `self_damage`**：二者用 `self_hp_cost`，而 `handlers.ts:273` 只为 `self_damage` 效果广播 `tags:['self_damage']`；`unarmed.ts:205` 的同类自伤因此标了 `self_damage`。若「卖血=自伤」应统一标注，则二者补标；若严格按效果类型，则维持现状（我按后者未计入 ❌）。
