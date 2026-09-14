# 奇物（ARTIFACTS）tag 审计

> 口径：`docs/_tag-audit/RUBRIC.md`。数据源：`src/data/artifacts.ts`（76 件）、`src/data/buffs/*.ts`、`src/data/actions/internal.ts`、`src/engine/entities/tag.ts`、`src/game/roguelite/reward-pool.ts`、`src/game/tagRelevance.ts`。
> 本审计为只读，未修改 `src/` 下任何文件。

## 结论摘要

- 实体数：76
- ❌ 6 条 / ⚠️ 46 条 / ✅ 24 条
- 问题归类：
  - **`inherent` 误标（硬错误）**：`inherent` 被 `reward-pool.ts:97` 用于把奇物排除出随机奖励池，标注口径为「义体 / 血脉限定」（`reward-pool.ts:96` 注释）。3 件**通用防具**（乌铠 `iron_will`、冰蚕衣 `frost_silk_robe`、斗铠 `combat_armor`）被标 `inherent`，玩家永远抽不到；1 件**义体**（人造发声器 `sonic_generator`）漏标 `inherent`，会进随机池（其余 14 件 implant 全部带 `inherent`）。
  - **元素 / 状态漏标**：`frost`（冰蚕衣招架后叠霜冻）、`paralyze`（金玲索/磁暴线圈）、`burn`（钛合金臂自爆）、`bleed`（软猬甲）、`stun`（飞狮吼）、`cleanse`（蜂草鱼囊 / 青囊三宝 / 战术腰包 / 自动净化背心）。
  - **`buff` 少标（方向无错）**：本次未发现「把 buff 当实现手段/内部标记却标了 `buff`」的假阳性；问题全在漏标——义体 stat_buff 真增益 9 件、酒类正面状态 4 件、血祭护腕、浮游眼等。义体体系统一不标 `buff`（与血脉/craft 同类奇物口径分歧）。
  - **`damage` 系统性缺标**：76 件奇物**无一**带 `damage`；而 `passives.ts` 有 6 处 `damage`。明确增伤的奇物（凝炁玉、守宫砂、血祭护腕、七心海棠、磁暴线圈、武学宝典上）均未标。
  - **`craft` 语义漂移**：`tag.ts` 定义 craft =「锻造品（天工出品，无副作用的人造装备）」，但药心石（药屋传家宝 + 持续耗炁）、玄门法衣（聚缠法衣）、忍者工具包（忍者随身油囊）、自动净化背心（秘制背心）、人造发声器（义体研究部特制）的描述均非「天工出品」。
  - **语义漂移 / 误关联**：浮游眼 `summon`（无 `summon` 定义）、凝炁玉缺 `qi`（增益仅对 qi 招式生效）、九阴真经 `qi`、聚缠法衣 `qi`、两件架势奇物缺 `stance`、液压腿缺 `move`。
  - **`debuff` 方向全部正确**：3 件带 `debuff` 的奇物（十香软筋散、西域奇毒、忍者工具包）均把负面状态施加给对手；自罚（义体 `ap_drain`/`overload`/`muscle_degradation`、斗铠身法-2、血祭护腕耗血）未被误标为 `debuff`，符合口径。
  - **`dot` 标签全库死标签**：`src/data/` 下无任何实体使用 `dot`（毒/流血类奇物也未标），见「需裁定」。

## 明细

| 实体 | 现 tags | 判定 | 理由（引用 effects/triggers/description） | 建议 |
| --- | --- | --- | --- | --- |
| 钛合金臂（titanium_arm） | `implant` `inherent` | ⚠️ | 义体身份正确（`implant`+`inherent`，`description`「重型钛合金义肢…可飞向对手自爆」）；`grantsActions: ['_arm_explosion']`，该招式 `tags: ['burn']`，对敌 `add_debuff burn stacks:8`、并对自身 `add_buff blood_loss`/`one_arm_buff`。自爆的灼烧与自伤代价未反映 | 可补 `burn`；按口径 `self_damage`（自伤代价）可补 |
| 液压腿（hydraulic_leg） | `implant` `inherent` | ⚠️ | `actionEnhancer` 对含 `damage` 的招式前置 `{ type:'short_dash', maxDistance:1 }`（冲刺/位移），`on_equip` 叠 `hydraulic_leg_speed`（移动效率+10%）。位移机制明确但未标 | 补 `move` |
| 机械眼球（mechanical_eye） | `implant` `inherent` | ⚠️ | `stat_buff {insight:4}` 为真增益，`insightReductionHalf()`＝洞察降低减半（防御性抗减益，`insightGuard.ts:24`）。`ap_drain` 为自罚，不计 `debuff`（正确） | 可补 `buff`、`defense` |
| 肌肉强化针（muscle_boost） | `implant` `inherent` | ⚠️ | `stat_buff {strength:5, agility:5}` 真增益；`muscle_degradation`（体/巧-2）为自罚不标 `debuff`（正确） | 可补 `buff`（口径分歧见需裁定） |
| 纳米金属心脏（nano_metal_heart） | `implant` `inherent` | ⚠️ | `stat_buff {strength:2, agility:2, dexterity:1}` 真增益；`ap_drain` 自罚 | 可补 `buff` |
| 合成肺叶（synthetic_lung） | `implant` `inherent` | ⚠️ | `stat_buff {vitality:2, strength:1, agility:1}` 真增益，无触发 | 可补 `buff` |
| 人造神经网络（neural_net） | `implant` `inherent` | ⚠️ | `stat_buff {agility:1, dexterity:4, insight:1}` 真增益；`fumble_chance`（永久失心，动作失败率）为自罚不标 `debuff`（正确） | 可补 `buff` |
| 战斗芯片（combat_chip） | `implant` `inherent` | ⚠️ | `stat_buff {wisdom:5}` 真增益；`fumble_chance` 自罚 | 可补 `buff` |
| 便携式核动力炉（power_furnace） | `implant` `inherent` | ⚠️ | `description`「输出炁态能量供炼炁士使用，加速炁的恢复」；`battle_start` 叠 `nei_xi_peng_pai`（`buffs.ts:1471` 每层 AP 恢复+10%）＝真增益，另叠 `permanent_burn`（过热，自身每 3 秒 1% 最大气血，自罚） | 按描述补 `qi`；可补 `buff`（注：奇物 `qi` 只影响关联权重，无战斗数值副作用） |
| 毒腺（venom_gland） | `implant` `inherent` `poison` | ⚠️ | `description`「每10秒消耗3层自身毒素，获得1点洞察」；`venom_gland` buff（`buffs.ts:993`）确实 `insight+1` 30 秒＝真增益；`poison` 与自身毒层机制绑定（正确） | 可补 `buff` |
| 髓泵（marrow_pump） | `implant` `inherent` | ⚠️ | `effects: max_hp_mod +60` 真增益；`ap_drain` 自罚（`description`「装置耗能」） | 可补 `buff` |
| 人造耳蜗（cochlear_implant） | `implant` `inherent` | ⚠️ | `stat_buff {insight:4, wisdom:1}` 真增益，无触发 | 可补 `buff` |
| 战斗芯片·改（doctor_chip） | `implant` `inherent` | ⚠️ | `stat_buff {wisdom:4}` + `combat_chip` buff（命中/暴击各+3%/层，`buffs.ts:1537`）真增益；`fumble_chance` 自罚 | 可补 `buff` |
| 浮游眼（floating_eye） | `imperial` `summon` | ❌ | 奇物**无 `summon` 字段**（对比 `flying_lion`/`fen_shen_qiu` 均有 `summon`），`effects` 只是 `add_buff floating_eye_buff`（`buffs.ts:1208` 洞察+4、暴击+10%） | 去掉 `summon`；补 `buff`；`imperial` 见需裁定 |
| 飞狮（flying_lion） | `summon` `imperial` | ⚠️ | `summon` 定义存在（`_flying_lion_roar`），`imperial`（御物）成立；但狮吼 `add_debuff stun stacks:1 chance:0.6`（`internal.ts:249`）未标 | 补 `stun` |
| 分身球（fen_shen_qiu） | `summon` | ⚠️ | `summon` 定义存在（`_fen_shen_shot`）正确；`description`「以炁维持分身」、`fen_shen_cost`（`debuffs.ts:223`「以炁维持分身」）→ 炁/御物关联未标；`on_equip max_ap_mod -1` 与耗炁为自罚，不计 `debuff`（正确） | 见需裁定（是否补 `qi`/`imperial`） |
| 菩提头环（pu_ti_tou_huan） | `buff` `defense` | ✅ | `stat_buff {wisdom:4}` 真增益；`stat_restriction` 50% 抵抗推演降低＝防御价值（`description`「推演+4，50%抵抗推演降低」） | 无需调整 |
| 血棘戒（blood_thorn_ring） | `trigger` `bleed` | ⚠️ | `blood_thorn_suppress`（`damage.ts:404`）暴击额外伤害按 14:1 转 `bleed`，对敌叠流血：`bleed`/`trigger` 正确；但「暴击的额外伤害转为流血层数」本质是输出增益，未标 `damage` | 见需裁定（`damage` 口径） |
| 血棘耳环（blood_thorn_earring） | `trigger` `bleed` `pierce` | ✅ | `requiredTags: ['pierce']` 与 `description`「持枪（刺）攻击」自洽；`blood_thorn_earring_buff`（`damage.ts:425`）刺击暴击+7%、对流血目标再+8% | 无需调整 |
| 通明符（wisdom_talisman） | `trigger` `buff` | ✅ | `stat_buff {insight:1}`＋`trigger_slot_mod +1`（额外承载一道触发），`trigger`/`buff` 均命中 | 无需调整 |
| 天生道种（innate_seed） | `inherent` | ✅ | 无 effects/triggers；功能在 `character-gen.ts:22`（持有时 +8 修炼点）与 `stories/sect.ts:12` 授予，属血脉特性，`inherent` 正确 | 无需调整 |
| 虎彻之眼（tiger_eye） | `trigger` `buff` | ⚠️ | `on_stance` → `_tiger_eye_foresight` 给 `foresight`（招架+30%）+`kanchuan`（闪避+10%），真增益、`trigger` 正确；`requiredTags: ['stance']` 且「进入居合时」＝架势收益 | 可补 `stance` |
| 定心香氛（calming_talisman） | `buff` | ⚠️ | `calming_fragrance`（洞察+2推演+2）+`calming_aftertaste` 真增益；但由 `on_stance` 驱动、`requiredTags: ['stance']` | 可补 `stance`、`trigger` |
| 吞炁囊（qi_guard） | `trigger` `defense` `qi` | ✅ | `battle_start` 叠 `qi_shield` 30 层（`defense.ts:10` 炁伤吸收2/非炁1），`description`「开局凝聚30层炁盾」 | 无需调整 |
| 乌铠（iron_will） | `trigger` `defense` `inherent` | ❌ | `description`「受到超过5点的拳脚/斩/刺/钝伤害时，消耗1AP减少4点」为通用护甲，既非义体也非血脉/先天特性，却因 `inherent` 被 `reward-pool.ts:97` 永久排除随机池。另：`dmg_reduce`（`defense.ts:28`）实际消耗**缠劲**（1缠-4点）并限 20 次，与描述「1AP」不符 | 去掉 `inherent`；按引擎补 `chan`；描述需与引擎对齐 |
| 凝炁玉（qi_amplifier） | `trigger` `buff` `craft` | ❌ | `description`「天工锻造的炁能增幅器，增幅炁系武器的锋芒」；`qi_amplify`（`damage.ts:71`）在 `onDealDamage` 里先判 `source.tags.includes('qi') || attacker.weaponDef.tags.includes('qi')`，非炁 build 完全无效。奇物缺 `qi` 会被非炁 build 抽到（错误关联） | 补 `qi` |
| 青竹斗笠（bamboo_hat） | `defense` | ⚠️ | `ranged_dodge` 闪避加成＝防御价值（正确）；但 `description`「距离≥5 额外 +15% 闪避」与 buff（`defense.ts:117` 距离≥4m、+20%）不一致（非 tag 问题，顺带记录）；同类触发型奇物多标 `trigger` | 可补 `trigger`；数值描述需对齐 |
| 冰蚕衣（frost_silk_robe） | `defense` `inherent` | ❌ | `frost_silk_robe_buff`（`defense.ts:823`）招架率+12%，招架近战后 `add_debuff frost`（对敌叠霜冻）——`frost` 元素漏标；且 `description`「冰蚕丝织就的软甲」为通用防具，无血脉/义体特征，`inherent` 会使其永远进不了随机池 | 去掉 `inherent`；补 `frost`；可补 `counter`（招架反制） |
| 淬毒工具（poison_coating） | `poison` `trigger` | ✅ | `poison_coating` buff（`buffs.ts:1492`）对 `pierce`/`slash` 招式 30% 概率给对手叠 `poison`，`description`「刃上淬毒，割裂或刺击时概率令其中毒」一致 | 无需调整 |
| 十香软筋散（shixiang_ruanjin_san） | `poison` `debuff` `trigger` | ✅ | `shixiang_ruanjin_san` buff（`buffs.ts:1510`）中毒时对**敌人**叠 `weakness`，`debuff` 方向正确 | 无需调整 |
| 西域奇毒（western_poison） | `debuff` `poison` `trigger` `paralyze` | ✅ | `western_poison_buff`（`buffs.ts:1658`）每次中毒对敌叠 3 层麻痹，方向与元素均正确 | 无需调整 |
| 他山之石（other_mountain） | `buff` | ✅ | `stat_buff {dexterity:1, insight:2, wisdom:2}` 真增益，`description`「博采众长，洞察入微」一致 | 无需调整 |
| 药心石（yao_xin_shi） | `craft` `defense` | ⚠️ | `defense` 正确（`yao_xin_shi_buff` 每 2 秒减免 3 点）；但 `craft` 定义为「天工出品」（`tag.ts:57`），而 `description`「药屋世代相传的护心石」非天工造物，且 buff 有副作用（`apRegenPerSec: -0.1`，与「无副作用」矛盾） | 依口径去 `craft`（或改描述） |
| 守宫砂（cinnabar_mole） | `trigger` `inherent` | ⚠️ | `cinnabar_mark`（`damage.ts:117`）每击叠雷印、满 4 引爆伤害×1.5＝显著增伤，未标 `damage`；`inherent`（龙虎山秘传之印）成立 | 见需裁定（`damage` 口径） |
| 金丝手套（golden_silk_gloves） | `defense` `craft` | ⚠️ | `effects: parry_mod 0.15`、`silk_guard`（`defense.ts:169`）`onCanParry: true` + 缴械抗性 30%，`description`「招架率+15%，空手可招架」＝与招架机制直接相关 | 补 `parry` |
| 蜂草鱼囊（herb_pouch） | `trigger` `heal` | ⚠️ | `herb_pouch` buff（`buffs.ts:552`）每 4 秒解毒 1 层并回 2 气血：`heal` 正确；「化解毒素」＝净化自身未标 | 补 `cleanse` |
| 菩斯曲蛇胆（snake_gall） | `buff` `inherent` | ✅ | `stat_buff {strength:2, vitality:2}` 真增益；服食异种蛇胆属身体特性（`inherent` 口径「血脉限定/特性」） | 无需调整 |
| 莽牯朱蛤（frog_gall） | `buff` `inherent` | ✅ | `stat_buff {dexterity:1, agility:1}`＋`poison_resist`（百毒不侵，`defense.ts:202`）真增益 | 无需调整 |
| 火眼金睛（fiery_eyes） | `buff` `inherent` | ✅ | `stat_buff {insight:5}` 真增益；`description`「历经焚炼」＝身体特性 | 无需调整 |
| 软猬甲（soft_hedgehog_mail） | `defense` `craft` | ⚠️ | `soft_armor`（`defense.ts:305`）减免所有伤害（`defense` 正确）；受拳脚攻击时给对手叠 `bleed`（`description`「反伤并令对手流血」）——`bleed`、`counter`（受击反制）未标；注意实现只叠流血、并无直接反伤 | 补 `bleed`、`counter`；描述「反伤」与实现不符 |
| 金玲索（golden_bell_rope） | `defense` | ⚠️ | `golden_bell_guard` 防御正确；`grantsActions: ['_golden_bell_swing']`（`internal.ts:265` `blunt`/`range`、`add_debuff paralyze chance:1`） | 补 `paralyze`；`range`/`blunt` 视「奇物是否携带招式形态 tag」口径；`qi`（描述「以炁御之」）见需裁定 |
| 蛊童圣体（gu_tong_body） | `inherent` `poison` | ✅ | `gu_tong_body` buff（`buffs.ts:901`）拳脚命中 40% 给对手叠毒、自身毒体减免 75%，`description`「从小被蛊毒炼就的毒体」＝身体特性 | 无需调整 |
| 蚀蛊（shi_gu） | `inherent` `poison` | ✅ | `shi_gu_buff`（`buffs.ts:931`）使施加的中毒每跳 20% 加深，`poison` 正确；`description`「自幼炼蛊」＝特性 | 无需调整 |
| 凝缠珠（chan_orb） | `buff` `chan` | ✅ | `chan_orb_regen`（`buffs.ts:353`）`chanRegenPerSec: () => 1`＝持续回复缠劲，`chan` 口径（消耗/回复缠劲）命中 | 无需调整 |
| 九阴真经（jiu_yin_zhen_jing） | `buff` `qi` `chan` | ⚠️ | `jiu_yin_zhen_jing_buff`（`buffs.ts:464`）`chanRegenPerSec: 洞察×0.1`＝缠劲回复，`chan`/`buff` 正确；但 `description`「以洞察悟缠劲」与**炁**无关（缠劲与内息/炁是不同资源，见 `gameplay-guide.md` 第三节），`qi` 属语义漂移（该 buff 自身也只标了 `qi`） | 依口径去 `qi`（若把「内功」宽解为炁则保留，见需裁定） |
| 血祭护腕（blood_sacrifice_armband） | `buff` `craft` `low_hp` | ⚠️ | `blood_sacrifice`（`damage.ts:213`）每招耗 1% 最大气血→等额额外伤害（`onDealDamage`）并挂 `blood_recovery`（`buffs.ts:1284` 每跳回血 5 秒）：`buff` 正确；但「额外伤害」未标 `damage`、「缓慢回复」未标 `heal`；`low_hp` 见需裁定 | 补 `damage`、`heal`；`low_hp` 待裁定 |
| 胁差（wakizashi） | `weapon` `counter` | ✅ | `triggers: [{ condition: { type:'on_dodge' }, actionId:'pursuit_thrust' }]`，`internal.ts:105`「顺势反击」`tags: ['trigger','counter',...]`，`description`「闪避后可立即反击」一致 | 无需调整 |
| 机巧面具（iron_mask） | `buff` `craft` | ✅ | `stat_buff {insight:3, wisdom:2}` 真增益，`description`「天工锻造的黑铁面具」与 `craft` 一致 | 无需调整 |
| 茴香豆（hui_xiang_dou） | `buff` | ✅ | `grantsActions: ['_eat_beans']` → `bean_buff`（`buffs.ts:1151` 全属性+1，10 秒），`description`「全属性+1，持续10秒」一致 | 无需调整 |
| 女儿红（nv_er_hong） | `jiu` | ⚠️ | `nv_er_hong` buff（`defense.ts:466`）每秒回 1.5 气血＝真实回血＋正面状态；`jiu` 正确，但 `heal`/`buff` 未标（同类正面状态奇物均标 `buff`） | 补 `heal`、`buff` |
| 霸王醉（ba_wang_zui） | `jiu` `chan` | ✅ | `ba_wang_zui` buff（`defense.ts:476`）每层每秒回 1 缠劲，`chan` 口径命中 | 无需调整 |
| 竹叶青（zhu_ye_qing） | `jiu` | ⚠️ | `zhu_ye_qing` buff（`defense.ts:447`）每层 AP 恢复+0.3/秒，`description`「内息奔涌」＝正面状态；`jiu` 正确但缺 `buff` | 补 `buff` |
| 烧刀子（shao_dao_zi） | `jiu` | ⚠️ | `shao_dao_zi` buff（`defense.ts:485`）每层暴击率+7%＝输出增益；`jiu` 正确但缺 `buff`/`damage` | 补 `buff`（`damage` 见需裁定） |
| 不老泉（bu_lao_quan） | `jiu` | ⚠️ | `bu_lao_quan` buff（`defense.ts:456`）每 3 秒回 3 气血＝真实回血 | 补 `heal`、`buff` |
| 青囊三宝（qing_nang_san_bao） | `heal` | ⚠️ | `qing_nang_san_juan`（`buffs.ts:1314`）有毒解毒、没毒回 7 气血：`heal` 正确；「解毒/止血」（解除负面）未标 | 补 `cleanse` |
| 菩提珠串（pu_ti_zhu） | `buff` `defense` | ✅ | `stat_buff {wisdom:3}` 真增益；`pu_ti_zhu_buff`（`defense.ts:662`）50% 免疫临时失心＝防御价值 | 无需调整 |
| 百纳珠（bai_na_zhu） | `defense` | ✅ | `bai_na_zhu_buff`（`defense.ts:783`）`onCritTakenDamage: -0.3`，`description`「被暴击伤害降低30%」一致 | 无需调整 |
| 斗铠（combat_armor） | `defense` `inherent` | ❌ | `description`「百战之铠，非炁伤害减免，但身法-2」为通用铠甲，非义体/血脉，`inherent` 导致永远不进随机池（`reward-pool.ts:97`）；`combat_armor_def`（`defense.ts:415`）减伤＝`defense` 正确，身法-2 为自罚不计 `debuff`（正确） | 去掉 `inherent` |
| 聚缠法衣（ju_chan_fa_yi） | `craft` `buff` `qi` `chan` | ⚠️ | `ju_chan_fa_yi` buff（`buffs.ts:362`）吸缠化属性（力/身/巧/推演+2）＝真增益，`chan`/`buff` 正确；但机制只涉及**缠劲**，「玄门法衣」也无炁机制（`qi` 漂移），且非「天工出品」（`craft` 漂移） | 建议去 `qi`、`craft`（需裁定） |
| 发辫刃（braid_blade） | `weapon` `inherent` | ⚠️ | `on_opponent_move_away` → `_braid_blade`（`internal.ts:349` `slash`/`pierce` 追击）：`weapon`/`inherent`（发辫一体）可接受，但追击＝受激反制、招式形态 tag 未随身 | 可补 `slash`、`pierce`、`counter` |
| 战术腰包（tactical_pouch） | `trigger` `heal` | ⚠️ | `grantsActions: ['_field_dressing','_detox_shot','_adrenaline_shot']`：止血针/解毒针为 `cleanse`（`internal.ts:368/380`），肾上腺素针 `add_buff adrenaline_rush`（真增益）；`heal` 正确，缺 `cleanse`/`buff`；第三个触发条件为 `hp_below`（`ctx.actor.hp/maxHp < 0.5`） | 补 `cleanse`、`buff`、`low_hp` |
| 七心海棠（qi_xin_hai_tang） | `poison` `inherent` | ⚠️ | `qi_xin_hai_tang` buff（`buffs.ts:1425`）使施加的中毒伤害翻倍＝显著增伤，`poison` 正确但缺 `damage`；非血脉却标 `inherent`（见需裁定） | 补 `damage`；`inherent` 待裁定 |
| 暴雨梨花钉（tempest） | `inherent` | ⚠️ | `grantsActions: ['tempest']`（`internal.ts:394`：`pierce`/`range`/`thrown`/`chan`，5AP+满缠，27 段独立命中）；奇物自身未携带任何招式形态 tag；「机簧暗器」是否属血脉/义体存疑 | 可补 `pierce`/`range`/`thrown`/`chan`；`inherent` 待裁定 |
| 战术护目镜（tactical_goggles） | `craft` `buff` | ✅ | `stat_buff {wisdom:2, insight:2}`＋`insightReductionHalf()` 真增益，`description`「天工出品」与 `craft` 一致 | 无需调整 |
| 纳米外骨骼（nano_exoskeleton） | `craft` `buff` | ✅ | `stat_buff {strength:3, agility:3}` 真增益；`energy_drain`（每层 AP 回复-0.1/s）为自罚，不标 `debuff`（正确） | 无需调整 |
| 喷气式机动装置（jet_drive） | `craft` `buff` | ⚠️ | `rocket_boost`（`defense.ts:603` 免疫击倒）＋`jet_drive_speed`（移动效率+20%）真增益，`buff` 正确；`description`「免疫击倒」属控制免疫（防御价值）未标 | 可补 `defense`（`super_armor` 口径需裁定） |
| 能量护盾（energy_shield） | `craft` `defense` | ✅ | `energy_shield_buff`（`defense.ts:570`）以缠化盾吸收直伤（1缠:1伤），`description`一致 | 无需调整 |
| 蓄炁瓶（qi_battery） | `craft` `buff` | ⚠️ | `nei_xi_peng_pai`（每层 AP 恢复+10%）＝真增益（`buff` 正确）；`description`「天工锻造的炁能储存装置」→ `qi` 未标；`max_ap_mod -1` 为自罚不计 `debuff`（正确） | 可补 `qi`（口径见需裁定） |
| 磁暴线圈（ci_magnetic_coil） | `craft` `electric` `buff` | ⚠️ | `ci_magnetic_coil_buff`（`buffs.ts:1594`）电系招式伤害+15%＝`electric` 正确；「施加的麻痹层数翻倍」未标 `paralyze`；增伤未标 `damage` | 补 `paralyze`；`damage` 见需裁定 |
| 忍者工具包（ninja_tool_kit） | `craft` `debuff` | ⚠️ | `grantsActions: ['_oil_splash']` → 对敌叠 `oil_coating`（`debuffs.ts:245` 灼烧翻倍、身法-2），`debuff` 方向正确；`craft` 与「忍者随身油囊」不符（非天工出品） | 依口径去 `craft`；可补 `burn`（与灼烧联动） |
| 悬浮座椅（wheelchair_lightness） | `implant` `inherent` | ⚠️ | `wheelchair_speed`（`buffs.ts:425` 身法+2、移动效率+15%）真增益，缺 `buff`；`description`「以炁驱动」→ `qi` 可议 | 可补 `buff`；`qi` 见需裁定 |
| 人造发声器（sonic_generator） | `craft` `qi` `implant` | ❌ | 其余 14 件 `implant` 均带 `inherent`（义体不进随机池），此件漏标 → 会出现在随机奖励池（不该抽却能抽到）；`description`「义体研究部特制音波发声器」为义体，与 `craft`（天工造物）冲突；`grantsActions: ['_sonic_wave']`（`qi`/`range`/`debuff`）中 `qi` 已标，`debuff`/`range` 未标 | 补 `inherent`；去 `craft`（需裁定）；可补 `debuff`/`range` |
| 武学宝典总纲（wuxue_baodian_zonggang） | `buff` | ⚠️ | `wuxue_baodian_zonggang`（`buffs.ts:1023`）闪避/招架→叠 `martial_arts_crit`、暴击→叠 `martial_arts_dodge`，真增益（非纯载体），`buff` 正确；衍生攻防收益未标 | 可补 `damage`、`defense` |
| 武学宝典上（wuxue_baodian_shang） | `buff` | ⚠️ | `wuxue_baodian_shang`（`buffs.ts:1054`）每奖励标签伤害+1%（上限15%）＝输出增益，缺 `damage` | 补 `damage` |
| 武学宝典下（wuxue_baodian_xia） | `buff` | ⚠️ | `wuxue_baodian_xia`（`buffs.ts:1067`）每奖励标签受到伤害-1%（上限15%）＝防御价值，缺 `defense` | 补 `defense` |
| 自动净化背心（auto_purify_vest） | `defense` `craft` | ⚠️ | `auto_purify`（`buffs.ts:1345`）每 5 秒净化 1 层可净化负面（耗 1 缠劲）＝净化自身，`cleanse` 未标（`defense` 语义勉强）；`description`「秘制背心」非天工出品 | 补 `cleanse`；依口径去 `craft` |

## 需裁定（拿不准的）

1. **`low_hp` 口径冲突**：RUBRIC 二写「低血触发、越残越强才标」，而 `tag.ts:60` 注释含「用血换效果的奖励标签」。血祭护腕 `blood_sacrifice`（`damage.ts:213`）只按最大气血 1% 固定耗血、**无低血阈值/越残越强**，却标了 `low_hp`。按 RUBRIC 应去，按 tag.ts 注释可留。另：战术腰包有真正的 `hp_below 0.5` 触发，反而未标 `low_hp`。
2. **义体是否统一补 `buff`**：14 件 `implant` 的 `stat_buff` 都是真增益却不标 `buff`，而同为 `stat_buff` 的血脉奇物（菩斯曲蛇胆/莽牯朱蛤/火眼金睛）与 craft 奇物（机巧面具/战术护目镜/纳米外骨骼）都标了 `buff`。是「义体统一不标」还是漏标？
3. **`damage` 是否适用于奇物**：76 件奇物无一标 `damage`，而 `passives.ts` 有 6 处 `damage`；明确增伤者（凝炁玉 `damage.ts:71`、守宫砂 `damage.ts:117`、七心海棠 `damage.ts:1425`、血祭护腕 `damage.ts:213`、武学宝典上 `buffs.ts:1054`、磁暴线圈 `buffs.ts:1594`）是否统一补 `damage`/`bonus_damage`？
4. **`dot` 是死标签**：`grep "'dot'" src/data/` 无任何命中（actions/passives/weapons/buffs 全无）。毒/流血类奇物（淬毒工具、十香软筋散、西域奇毒、软猬甲、血棘戒）是否应补 `dot`，还是废弃该 tag？
5. **`craft` 口径**：`tag.ts:57` 写「天工出品，无副作用的人造装备」，RUBRIC 写「义体/天工造物」。药心石、玄门法衣（聚缠法衣）、忍者工具包、自动净化背心、人造发声器 5 件的描述都不是「天工出品」（药心石还有持续耗炁副作用）。是保留 `craft` 作「人造物」宽义，还是收窄到描述含「天工」者？
6. **`inherent` 的边界**：乌铠/冰蚕衣/斗铠三件通用防具被判 ❌（应进随机池）；而暴雨梨花钉（机簧暗器）、七心海棠（唐门至毒）同样非血脉/义体却标 `inherent`。若设计上「对手专属装备一律不进随机池」，这三件的 ❌ 需降级为 ⚠️；请确认 `inherent` 对奇物是否等同「非随机获取」。
7. **`sonic_generator` 是否应 `inherent`**：它是唯一不带 `inherent` 的 `implant`，但它同时带 `craft`（天工造物可随机）。二者只能取一，取决于它是「义体」还是「天工造物」。
8. **`qi` 的边界（内息 vs 炁）**：`gameplay-guide.md` 把内息（AP）与炁分列，但 `buffs.ts` 里 `jiu_yin_zhen_jing_buff`（缠劲）、`ju_chan_fa_yi`（缠劲）都标了 `qi`。据此，便携式核动力炉、蓄炁瓶（均为内息回复、描述称「炁能」）是否补 `qi`？九阴真经/聚缠法衣的 `qi` 是否应去？注：奇物 `qi` 目前只影响 `tagRelevance` 关联权重，不参与战斗判定（`qi` 判定读的是 action/weapon tags，见 `defense.ts:15`、`damage.ts:77`）。
9. **`imperial` 的边界**：浮游眼无 `summon` 字段、无御物耗炁，仅给自身 buff，`imperial` 是否成立？分身球（`fen_shen_cost`「以炁维持分身」）是否应补 `imperial`/`qi`？
10. **`stance` 是否要落到奇物上**：虎彻之眼、定心香氛用 `requiredTags: ['stance']` 门控且收益与架势相关，但奇物自身无 `stance` tag（全库奇物均无）。是否需要统一补？
11. **`trigger` 口径不一致**：13/76 标 `trigger`，但几乎每件奇物都有 `triggers` 数组（如冰蚕衣 `on_equip`、软猬甲 `battle_start`、能量护盾 `on_equip` 均未标）。`trigger` 是指「进入触发槽 build」还是「任意 triggers 数组」？
12. **描述与实现不一致（非 tag 问题，顺带记录）**：乌铠描述「消耗1AP减少4点」vs `dmg_reduce` 实为「1缠劲减4点、限20次」；青竹斗笠描述「距离≥5 额外+15%」vs `ranged_dodge` 实为「≥4m、+20%」；软猬甲描述「反伤并令对手流血」vs `soft_armor` 只叠 `bleed` 无直接反伤；女儿红描述「持续5秒」vs buff「持续9秒」。
