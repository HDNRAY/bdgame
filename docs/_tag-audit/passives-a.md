# 功法（被动）· 上半 tag 审计（前 55 个）

## 结论摘要

- 实体数：**55**（`src/data/passives/passives.ts` 中 `PASSIVES` 按数组顺序第 1–55 个：`forge`(id 行 8) … `sword_intent_tempering`(id 行 642)，第 56 个 `yu_du_shu`(行 651) 起不在本次范围）
- **❌ 3 条 / ⚠️ 40 条 / ✅ 12 条**（❌ = `frost_mastery`、`momentum_mastery`、`one_arm`；✅ = `sword_dominion`、`ordinary_training`、`tai_chi_mastery`、`zoldyck_art`、`hui_lei_qian`、`baihu_ding`、`yin_shi_li_dao`、`weapon_stance`、`stone_skin`、`qishier_bian`、`hua_gun`、`lingxi_finger`）
- 问题归类：
  - **多标**（`buff` 被当实现手段/条件载体用，按 RUBRIC §二「增益」应去掉）：`nei_xi_mian_chang`、`yue_nv_sword`、`wan_xiang_jian_yi`、`shenxing_baibian`、`extreme`、`spirit_resonance`、`yuxin_sword_mastery`（各条理由见明细）。
  - **错标**（❌）：`one_arm`、`momentum_mastery` 把**给自己**的负面（`agility -2` / 名字叫"受到伤害+5%"的自身代价）标成 `debuff`；`momentum_mastery` 同时把"给对手叠刃炁"的收益标成 `damage`（应为 `buff`/`debuff`）。
  - **少标**（占绝大多数，影响面 = 抽卡权重 + UI 语义）：系统性缺 `passive`（55 条里仅 20 条带，见下）、缺 `buff` 17 条、缺 `damage` 5 条、缺 `defense` 3 条、缺 `debuff` 3 条；元素/状态漏标：`frost`（`frost_mastery`）、`burn`（`zhu_huo_jue`）、`bleed`（`momentum_mastery`）、`paralyze`（`thunder_art`）。
  - **语义漂移**：`qi` 泛标（`iron_bone`、`extreme`、`zhou_liu_bu_xi`、`wan_xiang_jian_yi` 的描述/effects 与炁无关）；`damage` 泛标（`daily_grind`、`nei_xi_mian_chang`）；`low_hp` 漏标（`extreme` 条件为 `chan_overflow`，见需裁定）。
- 高危项提醒（按 RUBRIC §归类与暴露）：`inherent` 直接决定能否进随机奖励池（`reward-pool.ts:89`）。本次 55 条里带 `inherent` 的 4 条（`ordinary_training`、`daily_grind`、`zoldyck_art`、`one_arm`）与其 buff 定义（`ordinary_training`/`daily_grind` 为 `tags: ['damage','inherent']`、`zoldyck_art` 为血脉秘法、`one_arm` 为断臂）自洽，未发现 ❌ 级错标；反之 `yuxin_sword_mastery` 的 `buff` 定义 `yuxin_sword_mastery` 是"叠层上限翻倍"——见需裁定第 3 条。

### 补充：`passive` 标签的系统性缺口（跨条问题，计入各条 ⚠️）

`grep "'passive'" src --include=*.ts` 显示：引擎/游戏/UI 代码**不读取实体自身的 `passive` 标签**（只读 `weapon.tags`、buff `tags`），该标签目前只影响 tooltip 徽章与 `tagRelevance` 权重（权重 1）。因此缺 `passive` 是低影响，但文件内 55 条中仅 20 条带，属明显不一致。以下 35 条缺 `passive`：`forge`、`iron_bone`、`spirit_resonance`、`sword_dominion`、`last_sword`、`iaijutsu_mastery`、`human_radar`、`ice_heart`、`frost_mastery`、`nineteen_stops`、`extreme`、`zhou_liu_bu_xi`、`nei_xi_mian_chang`、`yu_yang_shi_ba_shi`、`yi_dian_po_xiao`、`inner_power`、`tai_chi_mastery`、`godspeed`、`thunder_art`、`hui_lei_qian`、`baihu_ding`、`qiti_source`、`stance_time`、`dark_room_catch`、`yue_nv_sword`、`one_arm`、`dark_iron_sword_art`、`tide_inner_power`、`shenxing_baibian`、`xuannv_sword`、`zhu_huo_jue`、`wan_xiang_jian_yi`、`stone_skin`、`qishier_bian`、`hua_gun`、`feng_mo_gong`、`frost_step`、`lingxi_finger`、`feng_wu_jiu_tian`、`beiming`、`golden_light`、`sword_intent_tempering`（共 42 项，含已在上文单列者）。建议：文件内统一（要么全带、要么全不带）。

### 补充：`buff` 判定依据（摘自 `src/data/buffs/`）

| 被动引用的 buff | 定义处 | 是否"真增益" |
| --- | --- | --- |
| `sangui_yuanqi` | buffs.ts:1304 `attrMods: 力/身/巧/洞察 +1` | 是 |
| `iron_defense` | defense.ts:211 `onTakeDamage: ×0.85` | 是 |
| `ji_lie_zhi_lie_buff` | damage.ts:160 叠层 `暴击+2%/层、暴伤+3%/层` | 是 |
| `spirit_resonance_buff` | buffs.ts:851 召唤物按段吃 `下取整(力道/3)` 增伤 | 是（构造期先付 `strength -2`） |
| `sword_dominion` | buffs.ts:1758 `buffEnhanceActionRange(+2)`＋`√apCost` 附加伤害 | 是 |
| `last_stand` | damage.ts:20 `onCritDamage: 缺血比例×1.0` | 是 |
| `shi_buff` | damage.ts:62 叠层 `暴伤+15%/层`（上限3） | 是 |
| `extreme` | damage.ts:31 `缠满时`给 `暴击+1%/缠、暴伤+3%/缠` | 是（条件性） |
| `zhou_liu_bu_xi` | buffs.ts:789 溢出叠层 `炁招命中+10%/层、伤害+10%/层` | 是 |
| `circle` | buffs.ts:163 `洞察+2`、4AP+ 招式 `命中+10%` | 是 |
| `elemental_immunity` | defense.ts:126 免疫霜冻、50% 免麻痹/灼烧 | 是 |
| `chill_blade` | buffs.ts:524 叠层 `伤害+8%/层` | 是 |
| `nineteen_stops` | damage.ts:138 叠层 `命中/暴击/暴伤 +1%/层` | 是（同时叠"越易失手"） |
| `ordinary_training` | defense.ts:145 `身法→闪避、灵巧→招架` | 是 |
| `daily_grind` | damage.ts:9 `洞察→命中、推演→闪避` | 是 |
| `momentum_mastery_buff` | buffs.ts:1772 只 `add_debuff('blade_qi')`，**自身无数值收益** | 否 |
| `inner_power_cost` | buffs.ts:296 只 `apRegenPerSec: -N×0.15`（纯代价） | 否 |
| `overlord_art_buff` | buffs.ts:173 `重器命中+10%` / 否则 `暴击+15%` | 是 |
| `yi_dian_po_xiao_buff` | damage.ts:458 刺击 50% 转穿透 | 是 |
| `tai_chi` | defense.ts:158 `招架率/招架减伤 +0.6%/灵巧`、空手可招架 | 是 |
| `thunder_swift` | buffs.ts:515 `灵巧+1、洞察+1`（上限2层） | 是 |
| `thunder_bonus` | damage.ts:106 附加 `2 雷伤（1 穿透）` | 是 |
| `paralyze_immunity` / `thunder_constitution` | defense.ts:178/189 免麻痹、雷伤-80%/其他-10% | 是 |
| `hui_lei_qian` | buffs.ts:190 雷系招式 `命中+8%` | 是 |
| `baihu_ding` | defense.ts:288 闪避回复 2 缠 | 是 |
| `qi_shield` | defense.ts:10 吸收伤害（炁招2/其他1） | 是 |
| `yin_shi_li_dao` | buffs.ts:112 下次出招 `暴击率+20%` | 是 |
| `stance_armor` | defense.ts:244 `减伤10%`＋免眩晕/击退/缴械/击倒 | 是 |
| `polearm_stance` / `melee_stance` / `fist_stance` | buffs.ts:139/147/155 `命中/招架/闪避 +10%` | 是 |
| `heavy_training` | buffs.ts:663 重器负担-2、`招式AP-0.1` | 是 |
| `tide_power` | buffs.ts:638 每2秒在力/身间挪移4点（`attrMods`） | 是 |
| `min_move_cost` | buffs.ts:481 **无任何数值钩子**（只作移动消耗下限旗标） | 否 |
| `zhu_huo_jue_buff` | buffs.ts:587 受灼烧减半＋施加灼烧层数+1 | 是 |
| `wan_xiang_jian_yi_buff` | buffs.ts:619 按"非永久增益层数"给 `暴伤+5%/层` | 是（条件载体） |
| `stone_skin` | defense.ts:219 `直伤-12%`、灼烧减半 | 是 |
| `qishier_bian` | buffs.ts:694 每6秒轮流 `某属性+6` | 是 |
| `hua_gun_parry` | defense.ts:232 `灵巧×1% 招架，远程加倍` | 是 |
| `feng_mo_gong` | damage.ts:490 叠层 `伤害+1%/层、AP回复+0.03/s/层` | 是 |
| `frost_step_speed` | buffs.ts:416 `移动效率+25%` | 是 |
| `yuxin_sword_mastery` | buffs.ts:741 叠层上限翻倍（`onBuffApply ×2`）但每次叠层耗2缠 | 见需裁定 |
| `lingxi_finger` | defense.ts:257 `力+1/巧+3`、空手格挡、招架25%缴械 | 是 |
| `beiming` 的 `stat_transfer` | buffs.ts:220 每次命中 `推演+1`（同时敌方 `推演-1`） | 是＋给对手负面 |
| `golden_light` | damage.ts:191 受击耗缠减2、攻击耗缠加2 | 是 |

## 明细

| 实体 | 现 tags | 判定 | 理由（引用 effects/triggers/description） | 建议 |
| --- | --- | --- | --- | --- |
| 三分归元气（`forge`） | `qi` `heal` `buff` `defense` `low_hp` | ⚠️ | 描述"全属性提升。濒危时触发「三分归元」，消耗元气大幅回血"；`battle_start` 给 `sangui_yuanqi`（`attrMods` 力/身/巧/洞察+1，真增益 → `buff` 成立），`hp_below <0.3` 触发 `_sangui_heal`（`{type:'heal', ratio:0.2}` → `heal`、`low_hp`、`defense` 成立）。缺 `passive`；`qi` 只在 id/名称层面（"归元气"），机制无炁 | 补 `passive`；`qi` 是否保留见需裁定 |
| 铁布衫（`iron_bone`） | `qi` `buff` `defense` | ⚠️ | 描述"所受直伤-15%"；`battle_start` 给 `iron_defense`（`onTakeDamage ×0.85`）→ `buff`/`defense` 成立。`qi` 无任何依据（描述/effects/triggers 全无炁） | 去掉 `qi`；补 `passive` |
| 极烈之烈（`ji_lie_zhi_lie`） | `passive` `damage` | ⚠️ | 描述"每次受到伤害叠1层「烈」，每层提升暴击率与暴击伤害"；`battle_start` 给 `ji_lie_zhi_lie_buff`（叠层暴击/暴伤，真增益）。`damage` 成立，缺 `buff`（且该 buff 自己的 `tags:['damage']` 也未标 `buff`） | 补 `buff` |
| 灵器共鸣（`spirit_resonance`） | `summon` | ⚠️ | 描述"将自身力道转化为召唤物的攻击力"；构造期 `stat_buff {strength:-2}`（自付代价）＋`battle_start` 给 `spirit_resonance_buff`（召唤招按 `下取整(力道/3)` 增伤）→ `summon` 成立、`buff` 亦成立；缺 `passive` | 补 `passive`、`buff` |
| 御剑诀（`sword_dominion`） | `imperial` `qi` `range_up` | ✅ | 描述"以炁御剑，剑随意动。延长攻击距离"；`sword_dominion` 的 `onRuntimeAction` 加攻距 2（→ `range_up`），`onDealDamage` 按 `√apCost` 附加伤害（→ `buff` 实质增益），御物体系（→ `imperial`）、以炁御剑（→ `qi`）自洽 | 可补 `passive` `buff`（非必需） |
| 绝剑诀（`last_sword`） | `qi` `damage` `low_hp` | ⚠️ | 描述"伤势越重，剑意越强"；`last_stand` 的 `onCritDamage` 用 `1-hp/maxHp` 线性加成 → `damage`/`low_hp` 成立。缺 `buff`、`passive`；`qi` 无描述依据 | 补 `buff` `passive`；`qi` 见需裁定 |
| 居合道（`iaijutsu_mastery`） | `qi` `stance` | ⚠️ | 描述"习得居合斩与纳刀"；`grantsActions:['iaijutsu_strike','resheath']`，`battle_start` 触发 `_iaijutsu_ready` → `add_buff('iaijutsu')`（`tags:['stance']`，且 `resheath` 自带 `stance`）→ `stance` 成立。缺 `passive`；`qi` 无依据（居合为拔刀术） | 补 `passive`；`qi` 见需裁定 |
| 一刀流（`yi_dao_liu`） | `passive` `counter` `slash` | ⚠️ | 描述"招架时顺势反击,斩出顺劈"；`on_parry` → `light_slash`（`requiredTags:['slash']`、`tags:['slash']`）→ `counter`、`slash` 成立。但 `on_parry` 用的槽类型显示为 `on_parried`/`on_parry`，且未标 `trigger`（本条机制完全由触发器实现）；无 `parry` 标签可另议 | 可补 `trigger`（低影响） |
| 龙宫院流（`dragon_palace_style`） | `passive` | ⚠️ | 描述"招架或闪避后蓄势，叠加势"；`on_parry`/`on_dodge` 叠 `shi_buff`（叠层 `暴伤+15%/层`，真增益）→ 缺 `buff`；机制全为 stance-adjacent 的蓄势但并非架势系统（`shi_buff.tags:['damage']`） | 补 `buff`（可选 `trigger`） |
| 极（`extreme`） | `passive` `buff` `chan` | ⚠️ | 描述"缠劲满时获得极状态…每层提升暴击率与暴击伤害"；`chan_overflow` → `add_buff('extreme')`（真增益）→ `chan` 成立、`buff` 可成立。但该 buff 是**溢出条件的载体**（`onCritChance` 里当场 `spendChan(全部)` 并在下一招消费），按 RUBRIC「仅条件载体不算」应去 `buff`；同时触发条件与"低血量"无关，`low_hp` 不适用 | 去 `buff`（或保留并注明为条件增益）；补 `damage` `passive`；`qi` 无依据 |
| 周流不息（`zhou_liu_bu_xi`） | `passive` `buff` `qi` `chan` | ⚠️ | 描述"缠劲满溢时自动凝聚"；`zhou_liu_bu_xi` 按 `onChanOverflow` 溢出量每10点叠1层，给 `炁招命中+10%/层、伤害+10%/层` → `buff`、`chan` 成立；另需 `damage`（增伤）。`qi` 仅出现于 buff 描述（"炁招"），被动本体无炁资源/炁伤，属泛标 | 补 `damage`；`qi` 见需裁定 |
| 人体雷达（`human_radar`） | `buff` | ⚠️ | 描述"获得居合时锁定目标，下次近距离攻击命中提升"；`on_stance` → `add_buff('circle')`（`洞察+2`、4AP+ 招式命中+10%，真增益）→ `buff` 成立。缺 `passive`；`requiredTags:['stance']` 与 buff 实际对"任意 4AP+ 招式"生效存在语义偏差（机制非仅近距离）；无 `stance` 标签（本体不是架势，仅消费 `on_stance`） | 补 `passive`；描述/标签择一修正（`stance` 是否补见需裁定） |
| 冰心诀（`ice_heart`） | `passive` `defense` | ⚠️ | 描述"免疫霜冻，对麻痹、灼烧有50%几率免疫"；`elemental_immunity` 的 `onReceiveDebuff` 分别对 `frost`/`paralyze`/`burn` 返回 0 或 50% 免疫 → `defense` 成立，缺 `buff`（这是真增益状态）；元素侧只"免疫"不施加，`frost` 标与不标两可 | 补 `buff`；`frost` 见需裁定 |
| 冰霜诀（`frost_mastery`） | `passive` `debuff` | ❌ | 描述"命中时概率叠加寒霜，暴击时剑意凝寒"；`on_hit` → `add_debuff('frost', chance 0.5)`（`frost` 定义 `attrMods: 身法-0.5/灵巧-0.5`，给对手负面 → `debuff` 成立），`on_crit` → `chill_blade`（叠层 `伤害+8%/层`，真增益 → 缺 `buff`）。**漏标 `frost`**：本条是全局唯一稳定施加"寒霜"的 passive，却拿到 2 分流派权重之外的标签，抽卡关联会漏 | 补 `frost` `buff`；可补 `damage` |
| 十九停（`nineteen_stops`） | `passive` `buff` `damage` | ⚠️ | 描述"层数越高越易失手。每层提升命中、暴击与暴伤，最多19层"；`nineteen_stops` 叠层给命中/暴击/暴伤（真增益）、`onAction` 里按 `(层/19)²` 概率不叠并每次出手耗1缠 → `buff`/`damage` 成立，缺 `chan`（每次出手消耗1缠劲是硬性资源循环） | 补 `chan` |
| 平平无奇的锻炼（`ordinary_training`） | `passive` `defense` `inherent` | ✅ | 描述"身法提升闪避，灵巧提升招架"；`ordinary_training`（`onDodgeChance/onParryChance` 属性挂钩）→ `defense`/`buff` 成立；`inherent` 与 buff 定义自洽（"日复一日的锻炼"是角色特性，不进随机池）。可补 `buff` | 可补 `buff` |
| 日复一日的训练（`daily_grind`） | `passive` `damage` `inherent` | ⚠️ | 描述"洞察提升命中，推演提升闪避"；`daily_grind` 一半是**防御侧**（`onDodgeChance: 推演×0.004`），标 `damage` 只覆盖了进攻侧；缺 `defense`、`buff`。`inherent` 自洽 | 补 `defense` `buff`；`damage` 保留但语义偏窄 |
| 刃炁精通（`momentum_mastery`） | `passive` `damage` `debuff` `slash` | ❌ | 描述"每层受到伤害+5%。受到治疗时减少一层"——**这是给自己的负面代价**；`momentum_mastery_buff` 的 `onDealDamage` 实际行为是"持刃攻击令**对手**叠 `blade_qi`"，自身无任何数值收益。按 RUBRIC：`debuff` 只给对手上负面才标 → 本条的 `debuff` 错；对对手叠刃炁的收益应是 `buff`（或按 `blade_qi` 的 `debuff` 语义标 `debuff` 但理由不同），且 `blade_qi` 属流血系见 `bleed` | 去 `debuff`（改为 `buff`）；补 `bleed`；`slash` 成立（`requiredTags:['slash']`＋仅持刃触发） |
| 炁蕴绵长（`nei_xi_mian_chang`） | `passive` `buff` | ⚠️ | 描述"每点推演使自身 buff 时长+5%"；`effects:[{type:'buff_duration_mult'...}]`——这是**对已有增益的时长增幅**，本体不施加任何增益状态，按 RUBRIC「仅把 buff 当实现手段/条件载体不算」应去 `buff`（其收益应归 `defense`/泛增益而非 `buff`） | 去 `buff`；可补 `defense`（收益偏防御/续航，需说明） |
| 轮舞月斩（`overlord_art`） | `passive` `damage` | ⚠️ | 描述"长兵轮转，如月之轮舞。每一刀都顺势回旋突进"；`battle_start` 给 `overlord_art_buff`（重器 `命中+10%`/否则 `暴击+15%`，真增益）、`actionEnhancer` 给所有 `slash` 招加 `short_dash`、`grantsActions:['retrieve_blade']`（`tags:['retrieve_weapon']`）→ 缺 `buff`、`polearm`、`retrieve_weapon`、`move` | 补 `buff` `polearm`；`retrieve_weapon`/`move` 可选 |
| 渔阳十八势（`yu_yang_shi_ba_shi`） | `passive` `buff` | ⚠️ | 描述"身法转化感知"；`attr_convert 敏捷→洞察 ×0.3`（构造期永久加洞察，显性正收益）→ `buff` 成立。缺 `defense`（洞察提升招架/命中，属泛收益，低置信） | 可补 `defense`（择一） |
| 一点破晓（`yi_dian_po_xiao`） | `passive` `buff` | ⚠️ | 描述"刺击以点破面，劲力透体"；`yi_dian_po_xiao_buff` 把**刺击招式**伤害 50% 转穿透（`tags:['damage','pierce']`）→ `buff` 成立，缺 `pierce`（效果只对 `pierce` 招式生效）、`damage`、`ignore_parry`（穿透部分无视招架） | 补 `pierce` `damage`；`ignore_parry` 见需裁定 |
| 归元劲（`inner_power`） | `passive` `buff` | ⚠️ | 描述"每点推演提升力道，根骨，身法，灵巧"；`attr_convert 推演→力/根/身/巧 ×0.1`（构造期永久加属性，真增益）→ `buff` 成立；同时 `battle_start` 给 `inner_power_cost`（`apRegenPerSec` 负值，**纯代价**，不算 buff）。缺 `qi`（"内力/归元劲"为炁体系） | 补 `qi` |
| 太极（`tai_chi_mastery`） | `passive` `defense` | ✅ | 描述"每点灵巧提升招架率与招架减伤。空手可招架"；`tai_chi`（`onParryChance`/`onParryReduction`/`onCanParry`）→ `defense` 成立。可补 `buff` `parry` | 可补 `buff` `parry` |
| 疾风迅雷（`godspeed`） | `passive` `buff` `electric` | ⚠️ | 描述"闪避后蓄势；被击中时雷闪反击"；`on_dodge` → `thunder_swift`（灵巧+1/洞察+1，真增益）、`on_was_hit` → `_godspeed_counter`（`tags:['electric','counter']`，`{type:'damage', scaling:{insight:0.2}, piercing:1}`）→ `buff`/`electric` 成立，缺 `damage` `counter`（反击伤害是独立的第二个来源） | 补 `damage` `counter` |
| 雷法（`thunder_art`） | `passive` `buff` `electric` | ⚠️ | 描述"攻击附带雷击伤害，并概率麻痹对手"；`thunder_bonus`（附加 2 雷伤/1 穿透）＋`actionEnhancer` 给空手伤害招追加 `add_debuff('paralyze', chance = min(0.8, apCost×0.05))` → `buff`/`electric` 成立；**给对手叠加麻痹 → 漏 `debuff`**（也应可标 `paralyze`），另有附加伤害可标 `damage` | 补 `debuff` `damage`；`paralyze` 见需裁定 |
| 周氏秘法（`zoldyck_art`） | `passive` `buff` `electric` `inherent` | ✅ | 描述"雷电锻体，免疫麻痹并减免雷系伤害"；`battle_start` 同时给 `paralyze_immunity`＋`thunder_constitution`（雷伤-80%、其他-10%，真增益/防御）→ 四标全部成立；`inherent` 与"周氏秘法"血脉限定自洽（不进随机池）。可补 `defense` | 可补 `defense` |
| 虺雷牵（`hui_lei_qian`） | `passive` `buff` `electric` | ✅ | 描述"所有雷系招式命中+8%"；`hui_lei_qian` 的 `onHitChance` 对 `tags.includes('electric')` 的招式 +8% → `buff`/`electric` 成立（该 buff 自身 `tags:['electric']`） | 无 |
| 白虎定（`baihu_ding`） | `passive` `buff` `defense` `chan` | ✅ | 描述"闪避时回复缠劲"；`baihu_ding` 的 `onDodge` 里 `target.addChan(2)` → `chan` 成立；闪避回资源的续航价值 → `defense` 成立；`buff` 为该增益状态本体 | 无 |
| 炁体源流（`qiti_source`） | `passive` `buff` `qi` `low_hp` | ⚠️ | 描述"濒危时炁体护体吸收炁伤害，并将炁转化为力量、身法和灵巧"；`hp_below <0.2` → `_qiti_awaken`：`cleanse allDebuffs`、`add_buff('qi_shield', stacks:10)`（吸收伤害，防御向真增益）、`add_buff('qiti_awaken_buff')`、`stat_buff` 六维+2 → `qi`/`low_hp` 成立；缺 `defense`（吸收/净化是明确防御机制）、`cleanse` | 补 `defense` `cleanse` |
| 因势利导（`yin_shi_li_dao`） | `passive` `buff` `stance` | ✅ | 描述"进架势时因势利导，下一次出招暴击率增加，暴击后消散"；`on_stance` → `yin_shi_li_dao`（`onCritChance +0.2`，消费于 `on_crit`）→ `buff`/`stance` 成立；与 `requiredTags:['stance']` 自洽 | 无 |
| 转换时刻（`stance_time`） | `buff` `defense` | ⚠️ | 描述"进入架势时罡气护体，5秒内免疫眩晕、击退、打断、缴械、击倒，并减伤10%"；`on_stance` → `stance_armor`（`tags:['super_armor','defense']`，`减伤10%`＋`onReceiveDebuff` 免疫硬控）→ `buff`/`defense` 成立；缺 `super_armor`（buff 定义自带该 tag）、`stance`（完全由 `on_stance` 驱动，与同组条目 `yin_shi_li_dao` 不一致） | 补 `super_armor` `stance` `passive` |
| 行云流水（`weapon_stance`） | `passive` `buff` `stance` | ✅ | 描述"每次切换武器自动进入对应架势"；`on_weapon_change` 按武器 `tags`（`polearm`/`melee`/`unarmed`）切 `polearm_stance`/`melee_stance`/`fist_stance`（各自 `命中/招架/闪避 +10%`，真增益且在 `stance` 系统内）→ 三标成立 | 无 |
| 暗室抓雀功（`dark_room_catch`） | `passive` `defense` | ⚠️ | 描述"身法+2，灵巧+2，洞察降低效果减半"；`stat_buff {agility:2, dexterity:2}`（构造期永久加属性，真增益）＋`insightReductionHalf()` → `defense` 成立（闪避/招架收益），缺 `buff`（明写加属性） | 补 `buff` |
| 越女剑法（`yue_nv_sword`） | `buff` `passive` | ⚠️ | 描述"出剑极快，身随剑走"；`yue_nv_buff` 的 `battle_start` 触发器已被注释（第448行"short dash太op，暂时注释"），当前唯一实际效果是 `actionEnhancer` 给所有含 `damage` 的招加 `short_dash`（位移）。**本体不施加任何增益状态 → `buff` 是空标**（引用已注释） | 去 `buff`；补 `move` `damage` `passive`（`passive` 已有） |
| 不滞于物（`bu_zhi_yu_wu`） | `passive` `buff` | ⚠️ | 描述"按推演附加伤害"；`bu_zhi_yu_wu`（`onDealDamage final + 推演×0.05`，真增益）、`actionEnhancer` 给所有伤害招追加 `pierce` 标记 → `buff` 成立，缺 `damage`、`pierce`（该标记是为"越女剑意"类判定服务，同时也是 `pierce` 流相关系） | 补 `damage` `pierce` |
| 独臂（`one_arm`） | `passive` `debuff` `inherent` | ❌ | 描述"无法双持。运劲更凝练，招式消耗降低1AP（最低1）"；`one_arm_buff` 是 `attrMods:{agility:-2}`＋`onActionCost: -1`——**负面与收益都发生在本体身上**，不是给对手的负面。按 RUBRIC「`debuff`：给对手施加负面状态…给自己上的负面（如自伤代价）不算 `debuff`」→ `debuff` 错标。`inherent` 与"断臂"特性自洽（不进随机池） | 去 `debuff`；可补 `buff`（AP 消耗-1 是净收益，与 `agility -2` 并存）|
| 玄剑秘册（`dark_iron_sword_art`） | `passive` `buff` `heavy` | ⚠️ | 描述"虽无玄门血脉，亦可以炁御物…可减少重器的身法负担，并以剑意施展手上功夫"；`weapon_tag 'unarmed'`（让手上功夫可用）＋`heavy_training`（`重器负担-2`、`招式AP-0.1`，真增益）→ `buff`/`heavy` 成立；**缺 `heavy_reduce`**（`heavy_training.tags:['heavy_reduce']`，本条与 `tide_inner_power` 同为此用途）；描述中的"以炁御物"未给 `qi`/`imperial` | 补 `heavy_reduce`；`qi`/`imperial` 见需裁定 |
| 潮汐炁功（`tide_inner_power`） | `passive` `buff` `qi` | ⚠️ | 描述"每回合交替以力道或身法驱动招式。可化解重器的身法负担（固定-2）"；`tide_power` 的 `attrMods {strength:4, agility:0}` ＋每2秒在力/身间挪移 → `buff`/`qi` 成立（内力潮汐）；**缺 `heavy_reduce`**（`tide_power.tags:['heavy_reduce']`，与描述"化解重器身法负担"直接对应），`effects: []` 为空数组但 triggers 挂载 buff | 补 `heavy_reduce` |
| 神行百变（`shenxing_baibian`） | `passive` `buff` `defense` | ⚠️ | 描述"身法灵动百变，极难捉摸"；构造期 `dodge_mod +0.04`＋`haste: 推演×10`（真增益、防御向）→ `defense` 成立；`battle_start` 的 `min_move_cost`（buffs.ts:481）**没有任何数值钩子**，只是"移动消耗下限"旗标，按 RUBRIC 属实现手段 → `buff` 无对应实体增益 | 去 `buff`（保留 `defense`）；`move` 可选 |
| 玄女剑法（`xuannv_sword`） | `passive` `buff` | ⚠️ | 描述"以巧借力、以奇制胜，灵巧化为力道"；`attr_convert 灵巧→力道 ×0.3（floor）`（构造期永久加力道，真增益）→ `buff` 成立；缺 `damage`（力道提升直接转化为输出，且是"借力制胜"的卖点） | 补 `damage` |
| 铸火诀（`zhu_huo_jue`） | `passive` `buff` `qi` | ⚠️ | 描述"聚炁化火，火中淬炼不伤"；`zhu_huo_jue_buff`：受灼烧伤害减半＋**自己施加的灼烧层数+1** → `buff` 成立、`defense`（减伤向）成立；**缺 `burn`**（`requiredTags:['burn']` 已表明面向火系，"施加灼烧层数+1"是灼烧流核心增益，却拿不到 2 分 `burn` 权重） | 补 `burn` `defense` |
| 万象剑意（`wan_xiang_jian_yi`） | `passive` `buff` `qi` | ⚠️ | 描述"自身每有1层增益buff（不含debuff与永久buff），暴击伤害+5%"；`wan_xiang_jian_yi_buff` 的存在是**计数条件载体**（真正的收益是"按他 buff 层数加暴伤"），按 RUBRIC「仅把 buff 当条件载体不算」→ `buff` 应去；`qi` 无依据（描述/effects 全无炁） | 去 `buff`；补 `damage`；去 `qi` |
| 石肤功（`stone_skin`） | `passive` `defense` `buff` | ✅ | 描述"所受直伤-10%，灼烧伤害减半"；`stone_skin`（`onTakeDamage ×0.88`、`onDebuffTick` 灼烧减半）→ `buff`/`defense` 成立。可补 `burn`（明确针对灼烧） | 可补 `burn` |
| 七十二变（`qishier_bian`） | `passive` `buff` | ✅ | 描述"每6秒轮流使力道、体质、身法、灵巧、洞察、推演提升"；`qishier_bian` 每6秒给某属性 +6（真增益）→ `buff` 成立 | 无 |
| 舞花棍（`hua_gun`） | `passive` `defense` | ✅ | 描述"棍花如屏，可格挡远程攻击。灵巧越高招架远程越强"；`hua_gun_parry` 的 `onParryChance`（普通 `灵巧×1%`、远程 `×2%`）→ `defense` 成立。可补 `buff` `polearm`（`棍` 属长柄） | 可补 `buff` `polearm` |
| 疯魔功（`feng_mo_gong`） | `passive` `buff` | ⚠️ | 描述"招式命中叠1层「疯魔」…每层自身伤害+1%、受到伤害+2%、AP回复+0.03/秒"；`feng_mo_gong` 叠层给增伤/AP回复（真增益）但**同时提高自身受伤**；缺 `damage`、`self_damage`（受击伤害放大属"伤换伤"的负面代价，虽非直接自伤但语义接近） | 补 `damage`；`self_damage` 见需裁定 |
| 踏雪（`frost_step`） | `passive` `buff` | ⚠️ | 描述"踏雪如履平地，身法轻灵"；`frost_step_speed` 只有 `onMoveEfficiency +25%`（真增益）→ `buff` 成立，缺 `move`。**注意**：名称含"雪"但机制与霜冻无关（无 `frost` 状态/冰伤）→ 不应标 `frost`（本条正确未标） | 补 `move` |
| 真假无用心经（`yuxin_sword_mastery`） | `qi` `passive` `buff` `chan` | ⚠️ | 描述"所有可叠层 buff 上限翻倍，但每次叠层消耗缠劲"；`yuxin_sword_mastery` 的 `onBuffApply ×2`＋`onStackGain` 每次消耗 `2缠`（`char.spendChan(cost)`）→ `chan` 成立；但该 buff 是"抬高其他 buff 上限"的**机制载体**，本身不施加增益状态（且有硬代价）→ `buff` 应按 RUBRIC 去掉；`qi` 无依据 | 去 `buff`；去 `qi`（或按需裁定） |
| 灵犀一指（`lingxi_finger`） | `passive` `buff` `defense` | ✅ | 描述"空手入白刃，招架时缴械"；`lingxi_finger`（`力+1/巧+3`、`onCanParry`、`onParry` 25% `disarm`）→ `buff`/`defense` 成立。可补 `unarmed` `parry` | 可补 `unarmed` `parry` |
| 凤舞九天（`feng_wu_jiu_tian`） | `passive` `buff` | ⚠️ | 描述"凤舞九天，翩若惊鸿，来去如风"；`effects: []`、无 triggers，只有 `grantsActions:['feng_hui','feng_fan']`（两个 `tags:['move','pre_action'(,'post_action')]` 的位移招）。**本体不施加任何增益状态 → `buff` 无实物**；机制是位移，漏 `move` | 去 `buff`；补 `move` |
| 北冥神功（`beiming`） | `passive` `buff` `qi` | ⚠️ | 描述"命中时汲取敌方推演 1 点，持续 5 秒"；`on_hit` → `stat_transfer`：`先 enemy.attrs.modify(-1)` 再 `self.attrs.modify(+actual)`（buffs.ts:220 `tags:['buff']`，真增益）→ `buff` 成立；**给对手减推演 → 漏 `debuff`**；`qi` 仅 id/名称依据（北冥为道家炁功），机制本身不涉及炁资源 | 补 `debuff`；`qi` 见需裁定 |
| 金光咒（`golden_light`） | `passive` `buff` `defense` `qi` | ⚠️ | 描述"金光护体，AP上限-1"；`battle_start` 给 `max_ap_mod -1`＋`golden_light`（受击耗缠减2伤、攻击耗缠加2伤，真增益向）→ `buff`/`defense`/`qi`（缠劲/炁体系，`golden_light.tags:['qi','defense','damage']`）成立；缺 `damage`（`onAfterDealDamage` 附加 2 点） | 补 `damage` |
| 剑意淬体（`sword_intent_tempering`） | `passive` `buff` `defense` | ⚠️ | 描述"减免 slash/pierce 伤害，且单次受伤不超过最大生命的一定比例"；`sword_intent_tempering`（`onTakeDamage`：`slash`/`pierce` ×0.9、单次伤害上限 `maxHp×0.3`）→ `buff`/`defense` 成立；**该 buff 自身 `tags:['defense','inherent']`，是血脉特性却未在被动上标 `inherent`（会进随机池）**；可补 `slash` `pierce`（只对这两类减伤） | 补 `inherent`；`slash`/`pierce` 可选 |

## 需裁定（拿不准的）

1. **`debuff` 是否包含"给自己上的中性/收束型负面"**：`one_arm`（`agility -2`）、`momentum_mastery`（"每层受到伤害+5%"）按 RUBRIC §二字面（"给自己上的负面不算 `debuff`"）都是错标，但两者描述文本本身就把这段代价写在"代价"位置，UI 上标 `debuff` 是否属于团队既定约定，需要口径确认。本报告按 RUBRIC 判 ❌。
2. **`qi` 的边界**：`iron_bone`（铁布衫）、`extreme`、`zhou_liu_bu_xi`、`wan_xiang_jian_yi`、`yue_nv_sword`/`xuannv_sword` 等一批武侠类功法的 `qi` 只来自命名/世界观（"内力/元气/剑意"），代码里既无炁资源也无炁伤。若 `qi` 是"炁/内功体系"的宽口径世界观标签则应保留；若按 RUBRIC「与炁相关（炁资源、炁伤害、炁体、以炁驱动）」的机制口径则应大面积删除。本报告按机制口径给 ⚠️，未直接判 ❌。
3. **`yuxin_sword_mastery`（真假无用）的 `buff` 与 `yuxin_sword_mastery` buff 定义**："叠层上限翻倍"对玩家是长期正收益（可堆更高层数），但它同时是"每次叠层耗2缠"的闸门。按 RUBRIC 的"仅条件载体不算"倾向去 `buff`；若判定为"能力上的正收益"则应保留。两边证据都在 `buffs.ts:741-757`。
4. **`nei_xi_mian_chang`（炁蕴绵长）去掉 `buff` 后归哪个 tag**：它只放大已有增益时长（`buff_duration_mult`），既不是 `heal` 也不是 `defense`。若非要给一个“非空”标签，是补 `defense` 还是允许只有 `passive`，需裁定。
5. **`extreme`（极）是否算真增益**：`extreme` buff 由 `chan_overflow` 施加，效果是"缠满时消费全部缠给下次≥5AP招 暴击+1%/缠、暴伤+3%/缠"。属条件性正收益还是条件载体，取决于 RUBRIC §二第 1 条中"叠层增益（层数本身带来数值收益）"是否要求持续存在。本报告倾向"算"，因此未从 `buff` 判 ❌。
6. **`ignore_parry` 的适用范围**：`yi_dian_po_xiao`（50% 伤害转穿透）与 `sword_dominion`（御剑附加伤）都通过 `piercing` 输出绕过招架减免，但都不是"招式无视招架"。是否给 `ignore_parry` 需口径确认。
7. **`parry` / `stance` 是否需要与 `requiredTags` 联动补齐**：`human_radar`、`yin_shi_li_dao`、`stance_time` 都有 `requiredTags:['stance']` 却只有部分带 `stance`；`yi_dao_liu`/`lingxi_finger` 以招架为核心却不带 `parry`。这属于"标签仅用于展示/AI 权重"还是"要求与 requiredTags 一致"，需裁定。
8. **`retrieve_weapon` / `move` / `counter` 这类具体机制标签在功法上的粒度**：`overlord_art` 授予 `retrieve_blade`（含 `retrieve_weapon`）、`godspeed` 带 `_godspeed_counter`（含 `counter`）、`yue_nv_sword`/`feng_wu_jiu_tian` 带位移招。若约定"功法标签描述被动自身效果"则不必补"授予招式的机制标签"；若约定"能查到就算"则应补。本报告按前者低置信标注。
