# 功法（被动）后 55 个 tag 审计（passives-b）

> 范围：`src/data/passives/passives.ts` 的 `PASSIVES` 按文件顺序第 56 个（`yi_ma_xin_yuan`）到第 110 个（`ku_chan_shen_gong`）。
> 口径：`docs/_tag-audit/RUBRIC.md`（唯一标准）。判定中引用的 buff 定义见 `src/data/buffs/{buffs,damage,defense}.ts`，触发招式见 `src/data/actions/{internal,support}.ts`。
> 只读审计，未改动 `src/` 任何文件。

## 结论摘要

- 实体数：55
- ❌ 6 条 / ⚠️ 34 条 / ✅ 15 条
- 判定口径补充（本次为保持轻重一致而固定）：**❌** = tag 与机制直接矛盾（标了不存在的机制、机制方向反了、或 `inherent` 造成奖励池过滤错）；**⚠️** = 少标/多标/语义漂移，主要影响 `tagRelevance` 权重与 UI 展示。
- 问题归类：
    - **假 `buff`（本次重点）**：把「给对手上负面」「触发招式」「回血」的实现当成自身增益 —— `yi_ma_xin_yuan`、`tongtian`、`chou_dao_duan_shui`、`tai_shang_yu_fa`、`ling_ao_bu` 共 5 条；其中前 3 条同时漏 `debuff`，`tai_shang_yu_fa` 漏 `heal`。
    - **元素 tag 与机制不符**：`qi_electric_conversion`（`electric` 假、`qi` 漏标）。
    - **漏标「自己施加给对手的负面」**：`dian_xue_passive`（麻痹）、`sword_capture`（缴械）。
    - **漏标反伤/受击反制 `counter`**：`hun_yuan_gong`、`qian_kun_da_nuo_yi`、`ling_ao_bu`。
    - **漏标输出类 `damage`（含暴击/爆伤/连击/穿透）**：`yun_long_san_xian`、`dan_dao_fa_xuan`、`bai_ju_guo_xi`、`jing_luo_chu_jian`、`sword_focus`、`ru_yi_jin`、`karate`、`fei_hua_shou`、`lian_da_mi_jue`、`wolf_hunting`、`no_way_win`、`ling_long_xin_qiao`、`luo_ying_shen_jian`、`rui_qi_jue` 共 14 条。
    - **漏标武器类型（`tagRelevance` 权重 4，直接影响抽卡相关性）**：`slash`（`yun_long_san_xian`）、`unarmed`（`zui_quan`、`karate`）、`thrown`（`li_wu_xu_fa`、`fei_hua_shou`、`lian_da_mi_jue`）。
    - **漏标防御价值 `defense`**：`insight_awareness`、`mingjing_zhishui`、`no_light_wisdom`、`ku_chan_shen_gong`。
    - **`qi` 语义漂移**：多标 7 条（`tongtian`、`no_parry_style`、`yun_long_san_xian`、`bai_ju_guo_xi`、`chou_dao_duan_shui`、`ru_shen_zuo_zhao`、`chan_xin_hui_yan`），漏标 2 条（`qi_electric_conversion`、`autumn_water`）。
    - **其他**：`passive` 标记缺失 7 条；`buff` 借用/缺失 3 条（`gear_shift`、`combat_instinct`、`ningqi_jue`）；`move`/`trigger`/`ignore_parry` 少标若按口径应补，但全文件 110 条功法对这三个 tag 均为 0 处使用（可能属约定性省略，见「需裁定」）。
    - `stance` / `dot` / `summon` / `talent` 轴：本 55 条中 `stance`、`dot`、`talent` 无应标未标或误标（`talent` 由独立文件 `src/data/passives/talents.ts` 承担，本文件不带是对的）；`summon` 仅 `tai_shang_yu_fa` 一条存疑。

## 明细

| 实体 | 现 tags | 判定 | 理由（引用 effects/triggers/description） | 建议 |
| --- | --- | --- | --- | --- |
| 意马心猿（yi_ma_xin_yuan） | `passive` `buff` | ❌ | 引用 buff `yi_ma_xin_yuan`（buffs.ts:975）：`onHitChance: () => 0.05` 已被注释掉（buffs.ts:981），唯一生效钩子是 `onDealDamage → add_debuff 'confuse' 15%`，对自身无任何数值/能力收益，`buff` 是「给对手上负面的实现载体」；description 的「凝神聚气提升命中」在实现里已不存在 | 去 `buff`，补 `debuff` |
| 通天录（tongtian） | `passive` `buff` `qi` | ❌ | buff `tongtian`（damage.ts:174）全部效果是 `add_debuff 'bu_xing'`（80% 概率，降敌命中/闪避/招架/暴击，debuffs.ts:369），对自身零收益 → `buff` 假；缺 `debuff`；description 与 buff（tags 仅 `damage`）均无炁机制 | 去 `buff`·`qi`，补 `debuff` |
| 流风回雪（no_parry_style） | `qi` `buff` `defense` | ⚠️ | buff `no_parry_buff`（buffs.ts:1105）给出「招架率的22%转化为闪避率」，`buff`/`defense` 与实现一致；但 description 与 buff 均无炁（buff tags 为空），`qi` 无依据；本条是功法却缺 `passive` | 去 `qi`，补 |
| 云龙三现（yun_long_san_xian） | `qi` `buff` | ⚠️ | buff `draw_sword_combo_buff`（buffs.ts:1118）自带 `slash`，且 `onAction`/`onDealDamage` 都先判 `source.tags.includes('slash')`、交替斩击叠增伤并附加（身法+灵巧）伤害 → 核心武器类型是斩击、机制是增伤，`slash`/`damage` 均未标；`qi` 无依据（buff 无 qi） | 去 `qi`，补 `slash`·`damage` |
| 单刀法选（dan_dao_fa_xuan） | `passive` `buff` | ⚠️ | trigger `on_dodge → add_buff 'jing_ji'`（buffs.ts:130，下一击暴击率+25%）确为真实增益；按口径「暴击」属 `damage` 输出提升，未标 | 补 `damage` |
| 太上御法（tai_shang_yu_fa） | `passive` `buff` `qi` | ❌ | 全条无任何 `add_buff`：唯一 trigger 是 `on_summon_hit → actionId '_tai_shang_heal'`，该 action（internal.ts:499）唯一效果是 `{ type:'heal', value:1 }`，自带 tags `trigger`/`heal`/`internal` → 这是回血不是增益，`buff` 假且 `heal` 漏标 | 去 `buff`，补 `heal`（`summon`/`imperial` 见需裁定） |
| 白驹过隙（bai_ju_guo_xi） | `qi` `buff` | ⚠️ | buff `bai_ju_guo_xi_buff`（damage.ts:346）在 3 米内按身法加 3% 爆伤，是 `damage` 机制却未标；`qi` 无依据（buff tags 为 `buff`/`damage`）；另缺 `passive` | 去 `qi`，补 `damage`·`passive` |
| 抽刀断水（chou_dao_duan_shui） | `qi` `buff` | ❌ | buff `chou_dao_duan_shui_buff`（damage.ts:358）唯一效果是 `onCritical → target.reduceAp(1)` 且「回复重新起算」，收益全部由对手承担（负面）；自身无收益 → `buff` 假，缺 `debuff`；`qi` 无依据 | 去 `buff`·`qi`，补 `debuff` |
| 经络初鉴（jing_luo_chu_jian） | `passive` `buff` | ⚠️ | buff `jing_luo_chu_jian`（buffs.ts:1295）每点洞察+1%暴击，是真实增益；但暴击属 `damage` 输出提升，未标 | 补 `damage` |
| 灵枢真解（dian_xue_passive） | `passive` `debuff` | ⚠️ | buff `ling_xu_zhen_jie`（buffs.ts:1405）「招式30%概率造成2层麻痹」，`debuff` 方向正确、也没有误标 `buff`；但具体控制效果 `paralyze` 未标（description「点穴封脉」即指此） | 补 `paralyze` |
| 例无虚发（li_wu_xu_fa） | `passive` `buff` | ⚠️ | buff `li_wu_xu_fa`（buffs.ts:182）只在 `source.tags.includes('thrown')` 时给命中+50%，核心形态是暗器，`thrown` 未标 | 补 `thrown`（全文件功法 0 处使用，见需裁定） |
| 醉拳（zui_quan） | `passive` `buff` `jiu` | ⚠️ | `buff`（`zui_quan_dodge`，defense.ts:367：身法×0.6%闪避、有酒劲时×1.2）与 `jiu` 均成立；但 `actionEnhancer` 只对 `def.tags.includes('unarmed')` 的招式前置 `short_dash`，即空手+冲刺机制，`unarmed`/`move` 未标 | 补 `unarmed`·`move` |
| 九阳神功（jiu_yang_shen_gong） | `passive` `buff` | ✅ | battle_start → buff `nei_xi_peng_pai` 2.5 层（buffs.ts:1471：每层 AP 恢复速度+10%），是持续数值正收益，`buff` 成立 | 无需调整 |
| 混元功（hun_yuan_gong） | `passive` `qi` `defense` | ⚠️ | buff `hun_yuan_gong_buff`（defense.ts:615）近身受>8点或炁伤时「反伤所受一半 + 击退」，并 `spendChan` 消耗缠劲；description 明确写「反伤并击退对手」，但 `counter`/`knockback`/`chan` 均未标（`qi` 可保留：条件里明确含炁伤害） | 补 `counter`·`knockback`·`chan` |
| 醉里乾坤（qian_kun_da_nuo_yi） | `passive` `defense` `jiu` | ⚠️ | buff `qian_kun_fan_tan`（defense.ts:380）受击 10% 概率消耗等量缠劲反弹（上限 4+醉酒层）→ 反伤即 `counter`，且以缠劲为消耗资源；`defense`/`jiu` 成立 | 补 `counter`·`chan` |
| 怒炁充盈（sword_focus） | `passive` `buff` | ⚠️ | buff `sword_focus`（buffs.ts:1169）落空叠层、`onCritDamage` 每层+50% 爆伤、暴击后清空，是真实叠层增益；爆伤属 `damage`，未标 | 补 `damage` |
| 醉仙望月步（drunken_step） | `passive` `defense` `buff` `jiu` | ✅ | buff `drunken_step`（defense.ts:427）按醉酒层数给 6%闪避/层，`defense`/`buff`/`jiu` 与实现一致 | 无需调整 |
| 凝炁诀（ningqi_jue） | `passive` `qi` `inherent` | ⚠️ | `effects` 是 `stat_buff` 全属性+1、`actionEnhancer` 令全招带炁，确为数值正收益却未标 `buff`；`qi`（「以炁劲贯通全身」）与 `inherent`（description 明写「血脉限定」、reward-pool.ts:89 过滤）均正确 | 补 `buff` |
| 锐炁诀（rui_qi_jue） | `passive` `buff` `qi` | ⚠️ | buff `rui_qi_jue`（damage.ts:475，自带 `damage`/`qi`）把带炁招式 30% 伤害转穿透；`buff`/`qi` 成立，但 description 明说「无视招架与减伤」而 `ignore_parry` 未标，且缺 `damage` | 补 `damage`·`ignore_parry` |
| 无刀取（sword_capture） | `buff` `defense` | ⚠️ | `effects` 给 +1 触发槽；buff `sword_capture`（defense.ts:520）招架率+10%、招架成功 25% 概率缴械对手 → `buff`/`defense` 成立；缴械是给对手的负面（`debuff` 未标），且本条缺 `passive` | 补 `debuff`·`passive` |
| 如意劲（ru_yi_jin） | `passive` `buff` `chan` | ⚠️ | buff `ru_yi_jin`（damage.ts:374）暴击时耗 3 缠把灵巧×3% 转爆伤，`buff`/`chan` 成立；爆伤属 `damage` 未标 | 补 `damage` |
| 血战到底（blood_rage） | `passive` `buff` `low_hp` | ✅ | buff `blood_rage`（buffs.ts:1219）按血量 <60%/<25% 分档加力/身/巧，越残越强，`low_hp`+`buff` 与实现一致 | 无需调整 |
| 挂挡（gear_shift） | `passive` `buff` `chan` | ⚠️ | 本条自身无 `effects`/`triggers`，只有 `grantsActions:['gear_hang']`；真正的增益 `gear_shift_buff`（buffs.ts:1482，每层 AP 恢复+0.1/s）由所授招式「挂」施加，不是本条施加 | `buff` 见需裁定；`chan`（招式 chanCost 20，support.ts:100）正确 |
| 神照经（shen_zhao_jing） | `passive` `buff` `low_hp` | ✅ | buff `shen_zhao_jing`（buffs.ts:1249）AP 回复随血量下降而升高（封顶+0.4/s），`low_hp`+`buff` 一致（description 写 +0.5/s 与实现 0.4 有出入，属数值文案问题，非 tag） | 无需调整 |
| 空手道（karate） | `passive` `buff` | ⚠️ | buff `karate`（buffs.ts:265）只在 `source.tags.includes('unarmed')` 时生效（伤害×1.08、AP-0.2），即空手专属增伤，`unarmed`/`damage` 均未标（description 写 +10%/-0.5AP 与 buff 的 +8%/-0.2 也不一致） | 补 `unarmed`·`damage` |
| 漫天花雨（fei_hua_shou） | `buff` | ⚠️ | buff `fei_hua_shou`（buffs.ts:248）只在 `thrown` 招式上 `getExtraAttack:2` 并 AP-30%，属暗器连击增伤，`thrown`/`damage` 未标，亦缺 `passive` | 补 `thrown`·`damage`·`passive` |
| 练打秘诀（lian_da_mi_jue） | `buff` `chan` | ⚠️ | buff `lian_da_mi_jue`（buffs.ts:283）只对 `thrown` 招式附加灵巧×0.04（耗 1 缠后 ×0.08）伤害，`chan` 成立；`thrown`/`damage` 未标、缺 `passive` | 补 `thrown`·`damage`·`passive` |
| 毒药大师（du_yao_da_shi） | `passive` `inherent` `poison` | ✅ | buff `du_yao_da_shi`（buffs.ts:1437）只放大「施毒」（按自身暴击率多叠 1 层毒），不给自己增益，故不带 `buff` 是对的；`poison` 与 `inherent`（唐门世家＝血脉限定）与过滤逻辑一致 | 无需调整 |
| 舍得心法（sekai_heroism） | `passive` `buff` | ✅ | `effects` 为 `stat_buff`：根骨-2 换力道/身法/灵巧/洞察各+2，净收益为正，`buff` 成立；自减属性按口径不属 `debuff` | 无需调整 |
| 本能特训（combat_instinct） | `passive` `buff` | ⚠️ | 全条无任何 buff 施加，`effects` 是 `trigger_slot_mod`（每 5 洞察+1 触发槽）——增益来自触发器槽而非状态，`trigger` 未标 | 补 `trigger`；`buff` 见需裁定 |
| 先觉功（insight_awareness） | `passive` `buff` | ⚠️ | buff `insight_awareness`（defense.ts:538）按洞察给招架率+0.6%/点、闪避率+0.3%/点，是防御数值却未标 `defense` | 补 `defense` |
| 苍狼劲（wolf_hunting） | `passive` `buff` `chan` | ⚠️ | buff `wolf_hunting_buff`（damage.ts:308，自带 `damage`）耗 2 缠附加（力道+根骨+身法+灵巧）×5% 伤害，`chan` 正确；`damage` 未标 | 补 `damage` |
| 无招胜有招（no_way_win） | `passive` `buff` | ⚠️ | buff `no_way_win_buff`（damage.ts:439，自带 `damage`）只在 `triggered` 时伤害×1.25，是触发招式增伤：`damage`/`trigger` 均未标 | 补 `damage`·`trigger` |
| 玲珑心窍（ling_long_xin_qiao） | `passive` `buff` `inherent` | ⚠️ | buff `ling_long_xin_qiao_buff`（damage.ts:449，自带 `damage`）每点推演+1.5%暴击，`buff` 成立；`damage` 未标；`inherent` 依据见需裁定 | 补 `damage` |
| 秋水论（autumn_water） | `passive` `buff` | ⚠️ | buff `autumn_water_tide`（buffs.ts:325）在灵巧/洞察间每 2 秒挪移 1 点并+10% 移动效率，`buff` 成立；buff 自带 `qi` 而本条未标 | 补 `qi` |
| 不动明王（bu_dong_ming_wang） | `passive` `defense` `chan` | ✅ | buff `bu_dong_ming_wang_buff`（defense.ts:502）招架成功时耗 1 缠额外减免 3 点，`defense`/`chan` 与 description 一致 | 无需调整 |
| 移经易脉（ni_zhuan_jing_mai） | `passive` `defense` `counter` | ✅ | buff `ni_zhuan_jing_mai`（defense.ts:547）70% 概率抗麻痹、被暴击减伤 30%；另有 trigger `on_was_crit → '_generic_counter'`（internal.ts:104，自带 tags 含 `counter`），`defense`/`counter` 均与实现一致 | 无需调整 |
| 灵鳌步（ling_ao_bu） | `passive` `buff` `unarmed` | ❌ | 全条无 `add_buff`：trigger `on_dodge → '_ling_ao_chong'`，该 action（internal.ts:462）tags 为 `trigger`/`internal`/`unarmed`/`blunt`/`melee`，效果 `short_dash` 冲撞+伤害+60% 概率麻痹 → `buff` 假（`unarmed` 正确）；缺 `paralyze`、`counter`（闪避后反制）、`move`（冲刺） | 去 `buff`，补 `paralyze`·`counter`·`move` |
| 落英神剑（luo_ying_shen_jian） | `passive` `buff` `qi` | ⚠️ | buff `luo_ying_shen_jian_buff`（damage.ts:253，自带 `buff`/`qi`）寄存 20% 伤害、暴击双倍引爆，`buff`/`qi` 成立；这是纯伤害机制却缺 `damage` | 补 `damage` |
| 超强感知（enhanced_vision） | `passive` `buff` `defense` | ✅ | `effects` 为 `stat_buff` 洞察+4，buff `enhanced_vision_buff`（defense.ts:561）招架时按洞察减伤，`buff`/`defense` 与实现一致 | 无需调整 |
| 炁电转换（qi_electric_conversion） | `passive` `buff` `electric` `craft` | ❌ | buff `qi_electric_buff`（buffs.ts:1550）只按身上 `craft`/`implant` 装备数与推演给力道/身法/灵巧，没有任何电系伤害或麻痹/感电状态（description 也只说属性提升）→ `electric` 与机制不符、会把电系 build 的抽卡权重错误拉高；反之 description「以炁驱动装备」的 `qi` 未标 | 去 `electric`，补 `qi` |
| 千锤百炼（qian_chui_bai_lian） | `passive` `buff` `defense` `inherent` | ✅ | buff `qian_chui_bai_lian_buff`（buffs.ts:605）自身受灼烧-30% 属减伤，`defense`/`buff` 成立；`effects` 的 `attr_convert` 根骨化力道是数值正收益；`inherent`（天工特性 + 事件授予 branch.ts:551）与 `reward-pool.ts:89` 过滤一致 | 无需调整 |
| 无明之明（no_light_wisdom） | `passive` `buff` | ⚠️ | `effects` 洞察-4，但 buff `no_light_buff`（buffs.ts:1612）以推演换命中/闪避/招架/暴击并免疫迷眼，净收益为正，`buff` 成立；闪避/招架/免疫属防御价值，`defense` 未标 | 补 `defense` |
| 入神坐照（ru_shen_zuo_zhao） | `passive` `buff` `qi` | ⚠️ | buff `shen_zhao`（buffs.ts:1628）累计消耗 AP 分档+洞察（最多+6）、满档后免疫洞察减益，`buff` 成立；但 description 与 buff（tags 仅 `buff`）均无炁，`qi` 无依据 | 去 `qi`（免疫减益可否算 `defense` 见需裁定） |
| 听劲（hearing_power） | `passive` `buff` | ⚠️ | trigger 是无过滤的 `on_hit`（engine.ts:821 对所有命中发射），buff `hearing_insight`（buffs.ts:1673，洞察+2、1.5 秒）因此在任何武器命中都生效，与 description「每次徒手击中」不符；`buff` 本身成立 | 见需裁定（补 `unarmed` 或改文案） |
| 明镜止水（mingjing_zhishui） | `passive` `buff` | ⚠️ | buff `mingjing_zhishui_buff`（buffs.ts:1694）60% 概率抵抗失心/迷惑并令招式 AP 消耗-15%，`buff` 成立；「免疫负面」属防御价值，`defense` 未标 | 补 `defense` |
| 残影步（can_ying_bu） | `passive` `buff` | ⚠️ | buff `can_ying_bu_speed`（buffs.ts:435，移动效率+15%）与 `xu_ying`（buffs.ts:1714，每层+5%闪避）均为真实增益，`buff` 成立；本条完全由 `on_move_away`/`on_move_closer` 驱动，`move` 未标 | 补 `move` |
| 奇门八卦（ba_gua_gun_fa） | `passive` `buff` | ⚠️ | buff `ba_gua_bu`（buffs.ts:1723）每层+3%闪避/+5%暴击，`buff` 成立；层数只由移动事件叠加而 `move` 未标 | 补 `move` |
| 观自在眼（guan_zi_zai_yan） | `passive` `buff` `low_hp` | ✅ | buff `guan_zi_zai_yan`（buffs.ts:1258）按血量 <70%/<30% 分档加洞察/推演，越残越强，`low_hp`+`buff` 与 description 一致 | 无需调整 |
| 易筋经（yi_jin_jing） | `passive` `buff` | ✅ | `effects` 为 `stat_buff` 根骨+2、推演+2，`buff` 与实现一致 | 无需调整 |
| 玄武定（chanzi_chan_regen） | `passive` `buff` `chan` | ✅ | buff `chanzi_chan_regen`（buffs.ts:1814）每秒回 0.5 缠，资源持续回复属正收益，`buff`/`chan` 成立（description 写「每秒1点」与实现 0.5 有出入，属数值文案问题） | 无需调整 |
| 朱雀定（chan_ding） | `passive` `buff` `defense` `chan` | ✅ | buff `chan_ding_buff`（defense.ts:747）受击回复 2 点缠劲，`chan`/`buff` 与 description 一致 | 无需调整 |
| 青龙定（qing_long_ding） | `passive` `buff` `chan` | ✅ | buff `qing_long_ding_buff`（defense.ts:766）暴击时回复 5 点缠劲，`chan`/`buff` 与 description 一致 | 无需调整 |
| 禅心慧眼（chan_xin_hui_yan） | `passive` `buff` `qi` | ⚠️ | buff `chan_xin_hui_yan_buff`（buffs.ts:1824）按推演加命中/暴击，`buff` 成立；`qi` 在 description 与 buff（tags 仅 `buff`）中均无依据 | 去 `qi` |
| 枯蝉神功（ku_chan_shen_gong） | `passive` `buff` `chan` `low_hp` | ⚠️ | buff `ku_chan`（buffs.ts:1835）致死后无效该次伤害并耗尽缠劲，蜕壳 `ku_chan_tuo_ke`（buffs.ts:1867）免疫一切 DOT；`buff`/`chan`/`low_hp` 均成立，但「无效致死伤害+免疫 DOT」是防御价值，`defense` 未标 | 补 `defense` |

## 需裁定（拿不准的）

1. **`inherent` 的边界**：`tai_shang_yu_fa` 的 description 是「玄门祖传御法」，与已标 `inherent` 的 `ningqi_jue`（「药屋家传呼吸法，血脉限定」）同构，但当前未标 `inherent`，会进随机奖励池（`reward-pool.ts:89`）。同类还有只在单一对手处授予的 `zui_quan`（无志）、`ku_chan_shen_gong`（阿九）、`guan_zi_zai_yan`（姬然/拉月）、`ling_ao_bu`、`luo_ying_shen_jian` 等 —— 但这些功法同时出现在对手的 `rewards` 里（如 `wuzui.ts:21`、`ajiu.ts:24`），说明「可经击败对手获得」是既定设计，是否还要排除随机池需设计确认。
2. **`ling_long_xin_qiao` 的 `inherent`**：其 buff 是一次性数值增益（每点推演+1.5%暴击），却被标记 `inherent` 永久排除随机池；它同时授予 `xunxiang.ts:22` 与 `haoran.ts:25` 两名角色，「特性/血脉限定」的依据需确认。
3. **`gear_shift` 的 `buff`**：本条不施加任何状态，增益 `gear_shift_buff` 由所授招式「挂」产生。若按「本条自身是否给角色增益」严格判，应去掉 `buff`；若按「功法带来的收益链」判则保留。同类：`combat_instinct` 的 `buff` 只由 `trigger_slot_mod` 实现（无 buff 参与），口径需统一。
4. **`thrown` 的系统性缺失**：全文件 110 个功法 0 处使用 `thrown`，但 `li_wu_xu_fa`、`fei_hua_shou`、`lian_da_mi_jue` 只对 `thrown` 招式生效；若 `thrown` 是刻意留给武器/招式的约定，则这三条属约定性省略。
5. **`move` / `trigger` / `ignore_parry` 的系统性缺失**：这三个 tag 在 110 个功法中同样 0 处使用。本次按 RUBRIC 逐条建议补标（`zui_quan`/`can_ying_bu`/`ba_gua_gun_fa`/`ling_ao_bu` 的 `move`；`no_way_win`/`combat_instinct` 的 `trigger`；`rui_qi_jue` 的 `ignore_parry`），若属约定性省略可整体忽略。
6. **`hearing_power` 的触发范围**：description 写「每次徒手击中」，实现是无过滤的 `on_hit`（`engine.ts:821` 对任何命中发射，含召唤物），文案与实现不一致；应补 `unarmed` 还是修文案待定。
7. **`bai_ju_guo_xi` 的形态 tag**：buff 要求「距对手 3 米内」（damage.ts:353），是否应视为 `melee` 类形态 tag（功法中 `melee` 仅 1 处使用）。
8. **`ru_shen_zuo_zhao` 的 `defense`**：满 3 档后免疫一切洞察减益，是否按「免疫」补 `defense`。
9. **「缺 `damage`」的覆盖面**：按 RUBRIC「暴击」也计入 `damage`，本次共 14 条被列为漏标；但全文件 110 个功法仅 10 处使用 `damage`，是否属约定性省略（即 `buff` 已足够表达）需确认。
10. **`tai_shang_yu_fa` 是否属 `summon`/`imperial`**：其 trigger 条件为 `on_summon_hit`（只对召唤物命中生效，engine.ts:823），收益为自身回血；补 `summon` 还是 `imperial` 需确认。
