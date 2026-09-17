import type { ActionDefinition } from '../../engine/entities/action'
import { MAX_STAT_TRANSFER_LAYERS } from '../../engine/constants'
import { forEachBuffOf } from '../../engine/combat/utils'

/**
 * 辅助招式（非战斗直接伤害，含 buff / 位移 / 缴械回复 / 净化等）。
 * 与 PLAYER_ACTIONS 分开维护，奖励池中同样可出。
 */
export const SUPPORT_ACTIONS: ActionDefinition[] = [
    // ── 防御/增益 ──
    {
        id: 'guard',
        name: '听潮式',
        description: '凝神防守，如潮汐般稳固。大幅提升招架率。',
        requiredTags: ['parry'],
        apCost: 1,
        tags: ['buff', 'defense', 'post_action', 'stance', 'parry'],
        target: 'self',
        effects: [{ type: 'add_buff', buffId: 'guard_up' }],
        hookNotes: { canUse: '已有听潮状态时不可重复' },
    },
    {
        id: 'wind_hear',
        name: '听风式',
        description: '听风辩位，身随意动。提升闪避率，闪避后顺势前移。',
        requiredTags: [],
        apCost: 1,
        tags: ['buff', 'defense', 'post_action', 'stance'],
        target: 'self',
        effects: [{ type: 'add_buff', buffId: 'wind_hear_buff' }],
        hookNotes: { canUse: '已有听风状态时不可重复' },
    },
    {
        id: 'wan_liu_gui_zong',
        name: '归宗式',
        description: '万流归宗之势，完全招架远程攻击；未招架远程时叠1层灵巧。每场最多4次。',
        requiredTags: ['unarmed'],
        apCost: 1,
        tags: ['defense', 'unarmed', 'post_action', 'buff'],
        maxUses: 4,
        canUse: (attacker, state) => {
            // 已有归宗状态时不可重复（避免连续刷层吃AP）
            return !state.pendingBuffs.has(`wan_liu_gui_zong::${attacker.id}`)
        },
        hookNotes: { canUse: '已有归宗状态时不可重复；每场最多4次' },
        effects: [{ type: 'add_buff', buffId: 'wan_liu_gui_zong' }],
    },
    {
        // 无想剑：一刀既出，迅如雷，凛如冰，刀至极致，一击定胜负。强化下一招的命中与爆伤。
        id: 'wu_xiang_jian',
        name: '无想剑',
        description: '一刀既出，迅如雷，凛如冰，刀至极致，一击便可定胜负。',
        requiredTags: [],
        apCost: 1,
        chanCost: 3,
        tags: ['pre_action', 'buff', 'chan'],
        target: 'self',
        hookNotes: { canUse: '已有无想状态时不可重复' },
        effects: [{ type: 'add_buff', buffId: 'wu_xiang' }],
    },
    {
        id: 'blood_qi_protection',
        name: '血炁护体',
        description: '释放10%当前气血换取护体真气。',
        requiredTags: ['unarmed'],
        apCost: 0,
        tags: ['pre_action', 'buff', 'heal', 'defense', 'self_damage', 'low_hp'],
        target: 'self',
        canUse: (attacker, state) => {
            if (state.pendingBuffs.has(`blood_qi_protection::${attacker.id}`)) return false
            return true
        },
        hookNotes: { canUse: '已有护体时不可重复' },
        effects: [
            { type: 'add_buff', buffId: 'blood_qi_protection' },
            {
                type: 'functional_damage',
                fn: ({ self, state, engine }) => {
                    const cost = Math.max(1, Math.round(self.hp * 0.1 * 10) / 10)
                    if (self.hp <= cost) return 0
                    // spendHp：卖血触发 onHpChange（血战到底联动），但不回缠
                    self.spendHp(cost, engine)
                    // 100% 回复
                    const totalRecovery = cost
                    const key = `blood_qi_protection::${self.id}`
                    const layer = state.pendingBuffs.get(key)
                    if (layer) layer.restoreValue = totalRecovery
                    return 0
                },
                note: '消耗当前气血 10% 转为护体（血太少则无法发动）',
            },
        ],
    },
    {
        id: 'gear_hang',
        name: '挂',
        description: '凝缠劲为内息，消耗10缠劲，叠一层「挡」。',
        requiredTags: [],
        apCost: 1,
        chanCost: 10,
        tags: ['buff', 'pre_action', 'chan'],
        target: 'self',
        effects: [{ type: 'add_buff', buffId: 'gear_shift_buff', stacks: 1 }],
    },
    {
        id: 'cang_niao_jian_fa',
        name: '苍鸟诀',
        description: '苍鸟掠空，身如电驰。消耗10层缠劲，提高内息回复速度。',
        requiredTags: [],
        apCost: 0,
        chanCost: 10,
        tags: ['buff', 'pre_action', 'qi', 'chan'],
        target: 'self',
        effects: [{ type: 'add_buff', buffId: 'cang_niao_buff' }],
    },
    {
        id: 'flash',
        name: '闪光',
        description: '以炁激发强光致盲对手，范围广，效果显著。',
        requiredTags: [],
        apCost: 1,
        tags: ['debuff', 'pre_action'],
        getRange: () => [1, 5] as [number, number],
        effects: [{ type: 'add_debuff', buffId: 'sand_blind', stacks: 3, chance: 0.8 }],
    },
    {
        id: 'dao_ma_dan',
        name: '刀马旦',
        description: '入戏。消耗30缠劲进入刀马旦状态，持续15秒。期间力道身法灵巧各+1，招式带炁，回复内息与气血。',
        requiredTags: ['polearm'],
        apCost: 3,
        chanCost: 30,
        tags: ['buff', 'pre_action', 'qi', 'chan'],
        target: 'self',
        hookNotes: { canUse: '已入戏时不可重复' },
        effects: [{ type: 'add_buff', buffId: 'dao_ma_dan' }],
    },
    {
        id: 'scan_analysis',
        name: '扫描分析',
        description: '无人机扫描对手，分析战斗数据，提升命中与暴击。',
        requiredTags: ['imperial'],
        apCost: 1,
        tags: ['pre_action', 'buff', 'summon', 'imperial'],
        target: 'self',
        maxUses: 3,
        effects: [{ type: 'add_buff', buffId: 'scan_analysis', stacks: 1 }],
    },
    // ── 位移 ──
    {
        id: 'swift_step',
        name: '魅影步',
        description: '魅影乱步，身随心动。',
        requiredTags: [],
        apCost: 0,
        tags: ['move', 'pre_action'],
        target: 'self',
        effects: [
            { type: 'dash', maxRange: 3, targetDist: 0, useAp: true },
            { type: 'add_buff', buffId: 'phantom_step' },
        ],
    },
    {
        id: 'big_leap',
        name: '虎跃',
        description: '猛虎跃涧，瞬间近身。范围2~4m。需力道≥10。',
        requiredTags: [],
        apCost: 2,
        tags: ['move', 'pre_action', 'chan'],
        target: 'self',
        chanCost: 1,
        canUse: (attacker) => attacker.attrs.get('strength') >= 10,
        hookNotes: { canUse: '力道不足时不可使用' },
        effects: [{ type: 'dash', minRange: 2, maxRange: 5, targetDist: 0 }],
    },
    {
        id: 'lightning_speed',
        name: '电光石火',
        description: '电光石火，瞬息即至。',
        requiredTags: [],
        apCost: 1,
        chanCost: 4,
        tags: ['move', 'pre_action', 'chan'],
        target: 'self',
        effects: [{ type: 'dash', maxRange: 4, targetDist: 0 }],
    },
    {
        id: 'jindou',
        name: '筋斗',
        description: '一个筋斗翻腾而出，瞬间近身。范围1~8m。需身法≥10。',
        requiredTags: [],
        apCost: 2,
        chanCost: 3,
        tags: ['move', 'pre_action', 'chan'],
        target: 'self',
        canUse: (attacker) => attacker.attrs.get('agility') >= 10,
        hookNotes: { canUse: '身法不足时不可使用' },
        effects: [{ type: 'dash', minRange: 1, maxRange: 8, targetDist: 1 }],
    },
    {
        id: 'feng_hui',
        name: '凤迴',
        description: '如凤迴旋，瞬移至对手身后。',
        requiredTags: [],
        apCost: 1,
        tags: ['move', 'pre_action'],
        target: 'self',
        effects: [{ type: 'dash', maxRange: 8, targetDist: 0, useAp: false }],
    },
    {
        id: 'feng_fan',
        name: '凤反',
        description: '如凤反转，瞬移拉开距离。',
        requiredTags: [],
        apCost: 1,
        tags: ['move', 'pre_action', 'post_action'],
        target: 'self',
        effects: [{ type: 'dash', maxRange: 8, targetDist: -1, useAp: false }],
    },
    {
        id: 'yun_bu',
        name: '云步',
        description: '身形如云，缥缈难测。闪身至最大攻击距离，云步后身法缥缈，下次攻击更难招架闪避。',
        requiredTags: [],
        apCost: 2,
        tags: ['move', 'pre_action', 'buff'],
        target: 'self',
        effects: [
            { type: 'dash', maxRange: 4, targetDist: -1 },
            { type: 'add_buff', buffId: 'yun_bu_foresight', stacks: 1 },
        ],
    },
    {
        id: 'dian_bu',
        name: '瞬步',
        description: '瞬步调整站位，回到最佳攻击距离。',
        requiredTags: [],
        apCost: 0,
        tags: ['move', 'pre_action'],
        target: 'self',
        effects: [{ type: 'dash', maxRange: 2, targetDist: 2, useAp: false }],
    },
    {
        id: 'retrieve_blade',
        name: '滚地拾刀',
        description: '重握霸刀，恢复刀态。',
        requiredTags: [],
        apCost: 0,
        tags: ['pre_action', 'retrieve_weapon'],
        target: 'self',
        canUse: (attacker, state) => state.pendingBuffs.has('disarmed::' + attacker.id),
        hookNotes: { canUse: '被卸械时才能拾刀' },
        effects: [{ type: 'short_dash', maxDistance: 3 }, { type: 'retrieve_weapon' }],
    },
    {
        id: 'pickup_weapon',
        name: '拾起兵器',
        description: '捡回脱手的武器。',
        requiredTags: [],
        apCost: 0,
        tags: ['pre_action', 'retrieve_weapon'],
        target: 'self',
        canUse: (attacker, state) => {
            const key = `disarmed::${attacker.id}`
            const layer = state.pendingBuffs.get(key)
            if (!layer) return false
            const dropPos = layer.extra?.dropPosition as number | undefined
            if (dropPos === undefined) return true
            return Math.abs(state.position.get(attacker.id) - dropPos) <= 1
        },
        hookNotes: { canUse: '被卸械时才能拾起' },
        effects: [{ type: 'retrieve_weapon' }],
    },
    {
        id: 'santou_liubi',
        name: '三头六臂',
        description: `消耗27层缠劲，进入三头六臂状态：后续2个回合结束时AP回满。`,
        requiredTags: [],
        apCost: 3,
        tags: ['buff', 'pre_action', 'chan'],
        target: 'self',
        chanCost: 25,
        hookNotes: { canUse: '已处于三头六臂状态时不可重复' },
        effects: [{ type: 'add_buff', buffId: 'santou_liubi', stacks: 2 }],
    },
    {
        id: 'sand_throw',
        name: '抛沙',
        description: '扬沙迷眼，中距离干扰。',
        requiredTags: [],
        apCost: 1,
        tags: ['debuff', 'pre_action'],
        getRange: () => [1, 3],
        // 迷眼为 single 叠层：已迷眼时本次施加自动忽略，无需 canUse
        effects: [{ type: 'add_debuff', buffId: 'sand_blind', stacks: 3, chance: 0.8 }],
    },
    {
        id: 'shi_qi',
        name: '蚀炁',
        description: '以炁蚀敌，削弱对手气力与推演。',
        requiredTags: [],
        apCost: 1,
        chanCost: 7,
        tags: ['debuff', 'post_action', 'qi', 'range', 'chan'],
        getRange: () => [0, 4] as [number, number],
        effects: [{ type: 'add_debuff', buffId: 'weakness', stacks: 3, chance: 1 }],
    },
    {
        id: 'spirit_sword',
        name: '灵剑',
        description: '凝炁为刃，剑炁可穿透防御。',
        requiredTags: [],
        apCost: 0,
        tags: ['buff', 'pre_action', 'qi'],
        target: 'self',
        hookNotes: { canUse: '已凝出灵剑时不可重复' },
        effects: [{ type: 'ciyuan_init' }, { type: 'add_buff', buffId: 'ciyuan_blade' }],
    },
    // ── 御物系 ──
    {
        id: 'summon_haste',
        name: '御物加速',
        description: '御物加速，召唤物开火更快（叠1层，上限4层）。',
        requiredTags: ['summon'],
        apCost: 1,
        tags: ['imperial', 'summon', 'buff'],
        target: 'self',
        effects: [{ type: 'add_buff', buffId: 'summon_haste', stacks: 1 }],
    },
    {
        id: 'condense_shield',
        name: '凝炁成盾',
        description: '凝聚炁息化为护盾，2层炁盾护体。已有炁盾时不重复凝聚。',
        requiredTags: [],
        apCost: 1,
        tags: ['post_action', 'defense', 'buff', 'qi'],
        target: 'self',
        hookNotes: { canUse: '已有炁盾时不可重复' },
        effects: [{ type: 'add_buff', buffId: 'qi_shield', stacks: 2 }],
    },
    {
        id: 'agility_steal',
        name: '汲灵',
        description: '本体命中时吸取身法 1 点，持续 5 秒。',
        requiredTags: ['summon'],
        apCost: 1,
        tags: ['imperial', 'summon'],
        // 必定命中：偷取跟随本体（召唤物）命中触发，不额外滚命中判定
        onActionHitChance: () => 1,
        // 汲取已达上限（4层）时不再尝试触发
        canUse: (self, state) => {
            let layers = 0
            forEachBuffOf(state.pendingBuffs, self.id, (_def, _layer, buffId) => {
                if (buffId === 'stat_transfer') layers++
            })
            return layers < MAX_STAT_TRANSFER_LAYERS
        },
        hookNotes: { hitChance: '必中' },
        effects: [{ type: 'stat_transfer', stat: 'agility', value: 1, duration: 5000 }],
    },
    {
        id: 'drone_paralyze',
        name: '御物麻痹',
        description: '召唤物命中时350%概率附加1层麻痹。',
        requiredTags: ['summon'],
        apCost: 1,
        tags: ['imperial', 'summon', 'debuff', 'paralyze'],
        // 必定命中：跟随召唤物命中触发，不额外滚命中判定
        onActionHitChance: () => 1,
        hookNotes: { hitChance: '必中' },
        effects: [{ type: 'add_debuff', buffId: 'paralyze', stacks: 1, chance: 0.35 }],
    },
    {
        id: 'ling_qi_guan_zhu',
        name: '灵炁灌注',
        description: '将大量炁劲注入御物之中，增加伤害与命中。',
        requiredTags: ['imperial'],
        apCost: 1,
        tags: ['buff', 'pre_action', 'imperial'],
        target: 'self',
        effects: [{ type: 'add_buff', buffId: 'sword_enhance_buff' }],
    },
    // ── 禅子 · 禅修 ──
    {
        id: 'chanzi_heal',
        name: '甘露',
        description: '禅心化露，回气疗伤。',
        requiredTags: [],
        apCost: 1,
        chanCost: 10,
        tags: ['heal', 'qi', 'pre_action', 'chan'],
        target: 'self',
        effects: [
            {
                type: 'functional_heal',
                fn: ({ self }) => Math.round(self.hp * 0.03),
                note: '回复当前血量 3%',
            },
        ],
    },
    {
        id: 'chanzi_stance',
        name: '金刚不坏',
        description: '金刚不坏体，反震敌手。消耗10层缠劲，15秒内受到伤害时反伤15%。',
        requiredTags: [],
        apCost: 1,
        chanCost: 10,
        tags: ['buff', 'qi', 'pre_action', 'chan', 'defense', 'counter'],
        target: 'self',
        hookNotes: { canUse: '已有金刚不坏时不可重复' },
        effects: [{ type: 'add_buff', buffId: 'chanzi_stance' }],
    },
    {
        id: 'jin_zhong_zhao',
        name: '金钟罩',
        description: '金钟罩体，罡气护身。',
        requiredTags: [],
        apCost: 0,
        maxUses: 1,
        tags: ['defense', 'buff', 'pre_action', 'super_armor'],
        target: 'self',
        effects: [{ type: 'add_buff', buffId: 'jin_zhong_zhao' }],
    },
    {
        id: 'deng_ping_du_shui',
        name: '登萍度水',
        description: '身轻如萍，踏水无痕。消耗2层缠劲，位移至对手身前。',
        requiredTags: [],
        apCost: 0,
        chanCost: 2,
        tags: ['move', 'pre_action', 'chan'],
        target: 'self',
        getRange: () => [0, 12] as [number, number],
        effects: [{ type: 'dash', maxRange: 4, targetDist: 0 }],
    },
]
