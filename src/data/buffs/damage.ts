import type { BuffDef } from './types'
import { MAX_CHAN } from '../../engine/constants'
import type { ActionDefinition } from '../../engine/entities/action'
import { processActionEffect } from '../../engine/combat/effects'
import { round1 } from '../../engine/util/math'

export const DAMAGE_BUFFS: BuffDef[] = [
    {
        id: 'last_stand',
        name: '绝剑',
        description: '损失血量越多，暴击伤害越高。',
        tags: ['damage'],
        onCritDamage: ({ attacker }) => {
            const ratio = 0.1
            const missingRatio = 1 - attacker.hp / attacker.maxHp
            return round1(missingRatio * ratio * 10)
        },
    },
    {
        id: 'extreme',
        name: '极',
        description: '缠劲满时获得，下次≥5AP招式消耗所有缠劲，每层+1%暴击率和+3%暴伤。',
        tags: ['damage'],
        expiry: { type: 'permanent' },
        onCritChance: ({ source, attacker, layer, engine }) => {
            if (((source as ActionDefinition)?.apCost ?? 0) < 5 || attacker.chan < MAX_CHAN) {
                layer.restoreValue = 0
                return 0
            }
            const chan = attacker.chan
            attacker.spendChan(chan)
            layer.restoreValue = chan * 0.03
            engine?.emitLog({
                type: 'system',
                message: `[极] ${attacker.name} 极意绽放，缠劲尽散`,
                actorId: attacker.id,
            })
            return chan * 0.01
        },
        onCritDamage: ({ layer, state, attacker }) => {
            if (!layer.restoreValue) return 0
            const bonus = layer.restoreValue
            layer.restoreValue = 0
            const key = `extreme::${attacker.id}`
            state.pendingBuffs.delete(key)
            state.turn.removeEvents(`buff_end_${key}`)
            return bonus
        },
    },
    {
        id: 'shi_buff',
        name: '势',
        description: '招架或闪避后蓄势，每层暴击伤害+15%。',
        tags: ['damage'],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive', max: 3 },
        onCritDamage: ({ layer }) => layer.restoreValue * 0.15,
    },
    {
        id: 'qi_amplify',
        name: '炁意',
        description: '凝炁玉增幅，炁系招式伤害根据推演加成。',
        tags: ['qi', 'damage'],
        expiry: { type: 'permanent' },
        onDealDamage: ({ final, attacker, source }) => {
            const isQi = source?.tags?.includes('qi') || attacker?.weaponDef?.tags?.includes('qi')
            if (!isQi) return final
            const wis = attacker.attrs.get('wisdom')
            const mult = 1.1 + (wis - 3) / 170
            return round1(final * mult)
        },
    },
    {
        id: 'yue_nv_buff',
        name: '越女剑意',
        description: '白猿授剑，灵巧化为剑势，附加灵巧×0.06伤害（仅劈砍/戳刺招式）。',
        tags: ['pierce', 'slash', 'damage'],
        expiry: { type: 'permanent' },
        onDealDamage: ({ final, attacker, source }) => {
            // 仅 pierce 或 slash 招式生效（配合「不滞于物」的全招 pierce 标记可全招生效）
            const isBlade = source?.tags?.includes('pierce') || source?.tags?.includes('slash')
            if (!isBlade) return final
            return round1(final + attacker.attrs.get('dexterity') * 0.06)
        },
    },
    {
        // 不滞于物：按推演附加伤害
        id: 'bu_zhi_yu_wu',
        name: '不滞于物',
        description: '不滞于物，草木竹石皆可为剑。附加推演×0.06伤害。',
        tags: ['damage'],
        expiry: { type: 'permanent' },
        onDealDamage: ({ final, attacker }) => round1(final + attacker.attrs.get('wisdom') * 0.06),
    },
    {
        id: 'thunder_bonus',
        name: '雷法',
        description: '攻击附加2点雷击伤害（1点穿透）。',
        tags: ['qi', 'electric', 'damage'],
        expiry: { type: 'permanent' },
        onAfterDealDamage: ({ attacker }) => {
            attacker.spendChan(1)
            return { normal: 1, piercing: 1 }
        },
    },
    {
        id: 'cinnabar_mark',
        name: '守宫砂·印',
        description: '每次攻击积攒一颗雷印，满四颗后下一击爆发。',
        tags: ['damage'],
        expiry: { type: 'permanent' },
        onDealDamage: ({ final, attacker, layer, engine }) => {
            if (layer.restoreValue >= 4) {
                layer.restoreValue = 0
                engine?.emitLog({ type: 'system', message: '[守宫砂] 雷印爆发！伤害×1.5', actorId: attacker.id })
                return Math.round(final * 1.5 * 10) / 10
            }
            layer.restoreValue = (layer.restoreValue ?? 0) + 1
            engine?.emitLog({
                type: 'system',
                message: `[守宫砂] ${attacker.name} 雷印+1（${layer.restoreValue}/4）`,
                actorId: attacker.id,
            })
            return final
        },
    },
    {
        id: 'nineteen_stops',
        name: '十九停',
        description:
            '每次出手消耗2缠劲（无论命中与否）并叠一层，但层数越高越易失手（叠不上）。每层命中+1%、暴击+1%、暴伤+1%，最多19层。',
        tags: ['damage'],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive', max: 19 },
        onAction: ({ attacker, layer }) => {
            if (!attacker.spendChan(2)) return
            const stacks = layer.restoreValue ?? 0
            if (Math.random() < (stacks / 19) ** 2 * 0.95) return
            layer.restoreValue = Math.min(19, stacks + 1)
        },
        onHitChance: ({ layer }) => layer.restoreValue * 0.01,
        onCritChance: ({ layer }) => layer.restoreValue * 0.01,
        onCritDamage: ({ layer }) => layer.restoreValue * 0.01,
    },
    {
        id: 'ji_lie_zhi_lie_buff',
        name: '极烈',
        description: '受击愈烈，每层暴击率+2%, 暴击伤害+3%，最多7层。',
        tags: ['damage'],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive', max: 7 },
        onTakeDamage: ({ final, layer }) => {
            layer.restoreValue = Math.min(7, (layer.restoreValue ?? 0) + 1)
            return final
        },
        onCritChance: ({ layer }) => (layer.restoreValue ?? 0) * 0.02,
        onCritDamage: ({ layer }) => (layer.restoreValue ?? 0) * 0.03,
    },
    {
        id: 'tongtian',
        name: '通天大物',
        description: '悟生离死别，攻击命中时有概率令对手不幸缠身。',
        tags: ['damage'],
        expiry: { type: 'permanent' },
        onDealDamage: ({ final, attacker, target, engine, state }) => {
            // 攻击造成伤害时概率上「不幸」（降敌命中/闪避/招架/暴击）
            if (engine && Math.random() < 0.8) {
                processActionEffect(
                    { type: 'add_debuff', buffId: 'bu_xing', stacks: 1, chance: 1 },
                    { self: attacker, enemy: target, engine, tMs: state.turn.currentTime },
                )
            }
            return final
        },
    },
    {
        id: 'golden_light',
        name: '金光',
        description: '金光咒护体，受伤时消耗1层缠劲减免2点；非御物攻击消耗1层缠劲附加2点伤害。',
        tags: ['qi', 'defense', 'damage'],
        expiry: { type: 'permanent' },
        onTakeDamage: ({ final, target, engine }) => {
            if (!target.spendChan(1)) return final
            engine?.emitLog({
                type: 'system',
                message: `[金光咒] ${target.name} 消耗1层缠劲减免2点（剩${target.chan}层）`,
                actorId: target.id,
            })
            return round1(final - 2)
        },
        onAfterDealDamage: ({ source, attacker }) => {
            if (source?.tags?.includes('imperial')) return 0
            if (!attacker.spendChan(1)) return 0
            // 附加伤害由 bonus_damage 日志行展示（↳ [金光] 造成X），不在此重复打 buff 描述
            return 2
        },
    },
    {
        id: 'blood_sacrifice',
        name: '血祭',
        description: '每招消耗1%最大气血，造成等额额外伤害，并缓慢回复等额气血。',
        tags: ['damage'],
        expiry: { type: 'permanent' },
        onAction: ({ source, attacker, engine, state, layer }) => {
            if (!source || attacker.hp <= 0) return
            if (source.tags.includes('pre_action') || source.tags.includes('post_action')) return
            const hpCostPercent = 0.01
            const cost = Math.max(1, round1(attacker.maxHp * hpCostPercent))
            if (attacker.hp <= cost) return
            // spendHp：卖血触发 onHpChange（血战到底联动），但不回缠（自伤不走受击回缠）
            attacker.spendHp(cost, engine)
            layer.restoreValue = cost
            if (engine) {
                // 回血 = 消耗的气血（满额回溯，5 秒分跳）
                processActionEffect(
                    { type: 'add_buff', buffId: 'blood_recovery', stacks: cost },
                    { self: attacker, enemy: attacker, engine, tMs: state.turn.currentTime },
                )
            }
        },
        onDealDamage: ({ final, layer }) => {
            const cost = layer.restoreValue ?? 0
            if (cost <= 0) return final
            return round1(final + cost)
        },
    },
    // ── 千机暴击 ──
    {
        id: 'qianji_crit',
        name: '千机·千变',
        description: '千机百变，暴击伤害+30%。',
        tags: ['buff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onCritDamage: () => 0.3,
    },
    // ── 落英神剑（炁伤寄存印记） ──
    {
        id: 'luo_ying_shen_jian_buff',
        name: '落英神剑',
        description: '所有伤害的20%寄存于神剑印，当次伤害只生效80%。暴击时引爆神剑印，造成双倍寄存伤害。',
        tags: ['buff', 'qi'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onDealDamage: (ctx) => {
            const damage = ctx.final
            if (damage <= 0) return damage
            if (ctx.triggered) return damage
            if (ctx.attacker.chan < 1) return damage

            const stored = round1(damage * 0.2)
            if (stored <= 0) return damage

            const { state, engine } = ctx
            const markKey = `shen_jian_mark::${ctx.target.id}`
            let layer = state.pendingBuffs.get(markKey)

            // 首次命中需创建印记（需要 engine）
            if (!layer && engine) {
                processActionEffect(
                    { type: 'add_debuff', buffId: 'shen_jian_mark', stacks: 1, chance: 1 },
                    { self: ctx.attacker, enemy: ctx.target, engine, tMs: state.turn.currentTime },
                )
                layer = state.pendingBuffs.get(markKey)
            }

            if (layer) {
                if (!layer.extra) layer.extra = {}
                const prevStored = (layer.extra.stored as number) ?? 0
                layer.extra.stored = round1(prevStored + stored)
            }

            return round1(damage - stored)
        },
        // 暴击时引爆神剑印：造成寄存伤害的双倍，清空印记
        onCritical: ({ attacker, target, engine, state }) => {
            if (!engine) return
            const markKey = `shen_jian_mark::${target.id}`
            const layer = state.pendingBuffs.get(markKey)
            if (!layer) return
            const stored = (layer.extra?.stored as number) ?? 0
            if (stored <= 0) return
            state.pendingBuffs.delete(markKey)
            const explosionDmg = round1(stored * 2)
            target.takeDamage(explosionDmg, engine)
            engine.emitLog({
                type: 'system',
                message: `[落英神剑] 暴击引爆神剑印！寄存${stored}，双倍造成${explosionDmg}点伤害`,
                actorId: attacker.id,
            })
        },
    },
    {
        id: 'wolf_hunting_buff',
        name: '狼狩法则',
        description: '善用自重、惯性与借力造成额外伤害。消耗2层缠劲，附加（力道+根骨+身法+灵巧）×5%额外伤害。',
        tags: ['buff', 'damage'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onDealDamage: ({ final, attacker, source }) => {
            if (source?.tags?.includes('summon') || source?.tags?.includes('imperial')) return final
            if (!attacker.spendChan(2)) return final
            const bonus = round1(
                (['vitality', 'agility', 'strength', 'dexterity'] as const).reduce(
                    (sum, v) => sum + attacker.attrs.get(v),
                    0,
                ) * 0.05,
            )
            return round1(final + bonus)
        },
    },
    // ── 焰炁（焰拳附刃：本体伤害概率叠灼烧；分身/召唤物不触发） ──
    {
        id: 'yan_qi',
        name: '焰炁',
        description: '拳刃凝焰，任何伤害都有40%独立概率令目标叠2层灼烧。',
        tags: ['buff'],
        expiry: { type: 'duration', ms: 15000 },
        stacking: { type: 'none' },
        onDealDamage: ({ final, attacker, target, engine, state, source }) => {
            if (!engine || !target) return final
            // 本体伤害才触发；分身/召唤物（summon/imperial）不叠，避免高频白嫖灼烧
            if (source?.tags?.includes('summon') || source?.tags?.includes('imperial')) return final
            processActionEffect(
                { type: 'add_debuff', buffId: 'burn', stacks: 2, chance: 0.4 },
                { self: attacker, enemy: target, engine, tMs: state.turn.currentTime },
            )
            return final
        },
    },
    {
        id: 'bai_ju_guo_xi_buff',
        name: '白驹过隙',
        description: '距对手3米内，每点身法+3%暴击伤害。',
        tags: ['buff', 'damage'],
        stacking: { type: 'none' },
        onCritDamage: ({ attacker, target, state }) => {
            if (!state || !target) return 0
            if (state.position.distance(attacker.id, target.id) > 3) return 0
            return round1(attacker.attrs.get('agility') * 0.03)
        },
    },
    {
        id: 'chou_dao_duan_shui_buff',
        name: '抽刀断水',
        description: '暴击时对方气息一滞，AP-1，且回复重新起算。',
        tags: ['buff', 'damage'],
        stacking: { type: 'none' },
        onCritical: ({ attacker, target, engine, state }) => {
            if (!target || !engine) return
            target.reduceAp(1, state.turn.currentTime)
            engine.emitLog({
                type: 'system',
                message: `[抽刀断水] 「${target.name}」 气息一滞，AP-1`,
                actorId: attacker.id,
            })
        },
    },
    {
        id: 'ru_yi_jin',
        name: '如意劲',
        description: '暴击时消耗3缠，灵巧×3%暴伤。',
        tags: [],
        expiry: { type: 'permanent' },
        // 用 onAfterCritDamage：暴击结算前扣缠并立即生效。
        // 不能用 onCritDamage/onCritical 组合——引擎先跑 onCritDamage（读 bonus）再跑 onCritical（写 bonus），
        // 会导致本次暴击白扣 3 缠、加成落到下一次暴击（且不暴击则永久白耗）。
        onAfterCritDamage: ({ final, attacker, engine }) => {
            if (!attacker.spendChan(3)) return final
            const bonus = round1(attacker.attrs.get('dexterity') * 0.03)
            engine?.emitLog({
                type: 'system',
                message: `[如意劲] ${attacker.name} 消耗3缠，暴伤+${bonus}`,
                actorId: attacker.id,
            })
            return round1(final * (1 + bonus))
        },
    },
    {
        id: 'martial_arts_crit',
        name: '武学·破',
        description: '推演出的破绽洞察，每层暴击+2%、爆伤+5%。',
        tags: ['damage'],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive', max: 2 },
        onCritChance: ({ layer }) => layer.restoreValue * 0.02,
        onCritDamage: ({ layer }) => layer.restoreValue * 0.05,
    },
    {
        id: 'blood_thorn_suppress',
        name: '血棘·压制',
        description: '暴击时向创口渡入棘炁，爆伤按 10:1 转化为流血。',
        tags: ['damage'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        // 血棘戒：priority 最高 → 最后结算，读到的 final 是其他钩子处理后的完整伤害
        priority: 99,
        onAfterCritDamage: ({ damage, final, attacker, target, engine, state }) => {
            const extraDamage = final - damage
            const bleedStacks = Math.max(1, Math.round(extraDamage / 10))
            if (engine) {
                processActionEffect(
                    { type: 'add_debuff', buffId: 'bleed', stacks: bleedStacks, chance: 1 },
                    { self: attacker, enemy: target, engine, tMs: state.turn.currentTime },
                )
            }
            // 返回全量 = 没暴击的值：多出的爆伤按 10:1 全转流血，本次不再造成暴击伤害
            return damage
        },
    },
    {
        id: 'blood_thorn_earring_buff',
        name: '血棘·追魂',
        description: '持枪（刺）攻击暴击率+7%，对流血中目标再+8%。',
        tags: ['bleed', 'pierce', 'damage'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onCritChance: ({ source, target, state }) => {
            let bonus = 0
            if (source?.tags?.includes('pierce')) bonus += 0.07
            if (state.pendingBuffs.has(`bleed::${target.id}`)) bonus += 0.08
            return bonus
        },
    },
    {
        id: 'no_way_win_buff',
        name: '无招胜有招',
        description: '触发招式伤害+25%。',
        tags: ['damage'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        priority: 99,
        onDealDamage: ({ final, triggered }) => (triggered ? round1(final * 1.25) : final),
    },
    {
        id: 'ling_long_xin_qiao_buff',
        name: '玲珑心窍',
        description: '心窍玲珑，算尽对手每寸动作。每点推演+1%暴击率。',
        tags: ['damage'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onCritChance: ({ attacker }) => attacker.attrs.get('wisdom') * 0.015,
    },
    {
        id: 'yi_dian_po_xiao_buff',
        name: '一点破晓',
        description: '刺击招式伤害的50%转为穿透。',
        tags: ['damage', 'pierce'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        // 每次命中都拆 50% 穿透：基于结算后伤害拆（暴击时含爆伤，穿透吃爆伤），穿透部分无视招架/减伤/吸收
        onPostCritDamage: ({ final, source }) => {
            // pierce 判断：仅招式标签（非刺击招式不触发）
            const isPierce = source?.tags?.includes('pierce')
            if (!isPierce) return final
            const pierce = round1(final * 0.5)
            return { normal: round1(final - pierce), piercing: pierce }
        },
    },
    {
        // 锐炁诀：与凝炁诀联动（全招带炁 → 全招 30% 穿透）。穿透是「结算方式」非增伤，总伤害不膨胀
        id: 'rui_qi_jue',
        name: '锐炁诀',
        description: '炁凝如锋，锐不可当。带炁的招式，30%伤害转为穿透，无视招架与减伤。',
        tags: ['damage', 'qi'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onPostCritDamage: ({ final, source }) => {
            const isQi = source?.tags?.includes('qi')
            if (!isQi) return final
            const pierce = round1(final * 0.3)
            return { normal: round1(final - pierce), piercing: pierce }
        },
    },
    {
        // 疯魔功：任何招式命中叠疯魔层（≤5），每层伤换伤(+5%/-5%)；满5层下一招必中+伤害翻倍，用后归零
        id: 'feng_mo_gong',
        name: '疯魔',
        description:
            '势如疯魔，不守反攻。招式命中叠1层（最多5层），每层自身伤害+5%、受到伤害+5%；叠满5层后，下一招必中且伤害翻倍，用后归零。',
        tags: ['buff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive', max: 5 },
        onDealDamage: ({ final, source, layer, attacker, engine, state }) => {
            const isMain =
                !!source &&
                !source.tags.includes('pre_action') &&
                !source.tags.includes('post_action') &&
                !source.tags.includes('summon')
            const stacks = layer.restoreValue ?? 0
            // 满层状态（已是5层）：本招必中（onHitChance）已保证命中，吃5层增伤+翻倍，用后归零
            if (stacks >= 5) {
                const dmg = round1(round1(final * (1 + stacks * 0.05)) * 2)
                state.pendingBuffs.delete(`feng_mo_gong::${attacker.id}`)
                engine?.emitLog({
                    type: 'system',
                    message: `[疯魔] 「${attacker.name}」 疯魔爆发，一招定音！伤害翻倍`,
                    actorId: attacker.id,
                })
                return dmg
            }
            // 未满层：主招命中 → 先叠层，这一招就吃到新层（命中即疯，本招生效）
            let dmg = final
            if (isMain && engine) {
                const newStacks = Math.min(5, stacks + 1)
                layer.restoreValue = newStacks
                if (newStacks < 5) {
                    dmg = round1(final * (1 + newStacks * 0.05))
                    engine.emitLog({
                        type: 'system',
                        message: `[疯魔] 「${attacker.name}」 疯魔+1（${newStacks}/5）`,
                        actorId: attacker.id,
                    })
                } else {
                    // 叠到满层：本招吃+25%但不翻倍，下一招才爆发
                    dmg = round1(final * 1.25)
                    engine.emitLog({
                        type: 'system',
                        message: `[疯魔] 「${attacker.name}」 疯魔已满（5/5），下一招爆发！`,
                        actorId: attacker.id,
                    })
                }
            } else if (stacks > 0) {
                dmg = round1(final * (1 + stacks * 0.05))
            }
            return dmg
        },
        onTakeDamage: ({ final, layer }) => {
            const stacks = layer.restoreValue ?? 0
            if (stacks <= 0) return final
            return round1(final * (1 + stacks * 0.05))
        },
        onHitChance: ({ source, layer }) =>
            (layer.restoreValue ?? 0) >= 5 &&
            !!source &&
            !source.tags.includes('pre_action') &&
            !source.tags.includes('post_action') &&
            !source.tags.includes('summon')
                ? 1
                : 0,
    },
]
