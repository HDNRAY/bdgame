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
        onCritDamage: ({ attacker, layer }) => {
            const ratio = layer.restoreValue
            if (ratio <= 0 || attacker.hp >= attacker.maxHp) return 0
            const missingRatio = 1 - attacker.hp / attacker.maxHp
            // 残血爆伤：残血越多暴击越痛（九死·加很多）
            return round1(missingRatio * ratio * 10)
        },
    },
    {
        id: 'extreme',
        name: '极',
        description: '缠劲满时获得，下次≥5AP招式消耗所有缠劲，每层+1%暴击率和+2%暴伤。',
        tags: ['damage'],
        expiry: { type: 'permanent' },
        onCritChance: ({ source, attacker, layer, engine }) => {
            if (((source as ActionDefinition)?.apCost ?? 0) < 5 || attacker.chan < MAX_CHAN) {
                layer.restoreValue = 0
                return 0
            }
            const chan = attacker.chan
            attacker.spendChan(chan)
            layer.restoreValue = chan * 0.02
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
            return bonus * 2
        },
    },
    {
        id: 'shi_buff',
        name: '势',
        description: '招架或闪避后蓄势，每层暴击伤害+0.25。',
        tags: ['damage'],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive', max: 3 },
        onCritDamage: ({ layer }) => layer.restoreValue * 0.25,
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
            const mult = wis <= 4 ? 1.1 : wis >= 20 ? 1.3 : 1.1 + (wis - 4) * 0.0125
            return Math.round(final * mult * 10) / 10
        },
    },
    {
        id: 'yue_nv_buff',
        name: '越女剑意',
        description: '白猿授剑，灵巧化为剑势，附加灵巧×0.1伤害。',
        tags: ['pierce', 'slash', 'damage'],
        expiry: { type: 'permanent' },
        onDealDamage: ({ final, attacker }) => round1(final + attacker.attrs.get('dexterity') * 0.1),
    },
    {
        id: 'thunder_bonus',
        name: '雷法',
        description: '攻击附加3点雷击伤害（1点穿透）。',
        tags: ['qi', 'electric', 'damage'],
        expiry: { type: 'permanent' },
        onAfterDealDamage: () => ({ normal: 2, piercing: 1 }),
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
        description: '受击愈烈，每层暴击率+3%，最多7层。',
        tags: ['damage'],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive', max: 7 },
        onTakeDamage: ({ final, layer }) => {
            layer.restoreValue = Math.min(7, (layer.restoreValue ?? 0) + 1)
            return final
        },
        onCritChance: ({ layer }) => (layer.restoreValue ?? 0) * 0.03,
    },
    {
        id: 'tongtian',
        name: '通天大物',
        description: '悟生离死别，攻击命中时有概率令对手不幸缠身。',
        tags: ['damage'],
        expiry: { type: 'permanent' },
        onDealDamage: ({ final, attacker, target, engine, state }) => {
            // 攻击造成伤害时概率上「不幸」（降敌命中/闪避/招架/暴击）
            if (engine && Math.random() < 0.5) {
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
            return Math.max(0, Math.round((final - 2) * 10) / 10)
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
        description: '每招消耗2%最大气血，其中50%化为额外伤害，另外50%缓慢回复。',
        tags: ['damage'],
        expiry: { type: 'permanent' },
        onAction: ({ source, attacker, engine, state, layer }) => {
            if (!source || attacker.hp <= 0) return
            if (source.tags.includes('pre_action') || source.tags.includes('post_action')) return
            const hpCostPercent = 0.02
            const cost = Math.max(1, round1(attacker.maxHp * hpCostPercent))
            if (attacker.hp <= cost) return
            attacker.takeDamage(cost)
            layer.restoreValue = cost
            if (engine) {
                const totalRecovery = round1(attacker.maxHp * hpCostPercent * 0.6)
                processActionEffect(
                    { type: 'add_buff', buffId: 'blood_recovery', stacks: totalRecovery },
                    { self: attacker, enemy: attacker, engine, tMs: state.turn.currentTime },
                )
            }
        },
        onDealDamage: ({ final, layer }) => {
            const cost = layer.restoreValue ?? 0
            if (cost <= 0) return final
            return round1(final + cost * 0.6)
        },
    },
    // ── 千机暴击 ──
    {
        id: 'qianji_crit',
        name: '千机·千变',
        description: '千机百变，暴击伤害+50%。',
        tags: ['buff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onCritDamage: () => 0.5,
    },
    // ── 落英神剑（炁伤寄存印记） ──
    {
        id: 'luo_ying_shen_jian_buff',
        name: '落英神剑',
        description: '所有伤害的30%寄存于神剑印，当次伤害只生效70%。',
        tags: ['buff', 'qi'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onDealDamage: (ctx) => {
            const damage = ctx.final
            if (damage <= 0) return damage
            if (ctx.triggered) return damage
            if (ctx.attacker.chan < 1) return damage

            const stored = round1(damage * 0.3)
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

                // 已有印记时叠层（触发 onDebuffApply 检查满层引爆）
                // 寄存信息已由 shen_jian_mark.logFormat 在"获得状态"日志中合并输出
                if (engine && layer.restoreValue < 5) {
                    processActionEffect(
                        { type: 'add_debuff', buffId: 'shen_jian_mark', stacks: 1, chance: 1 },
                        { self: ctx.attacker, enemy: ctx.target, engine, tMs: state.turn.currentTime },
                    )
                }
            }

            return round1(damage - stored)
        },
    },
    {
        id: 'wolf_hunting_buff',
        name: '狼狩',
        description: '善用自重、惯性与借力造成额外伤害。消耗2层缠劲。',
        tags: ['buff', 'damage'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onDealDamage: ({ final, attacker, source }) => {
            if (!source?.tags?.includes('polearm') && !source?.tags?.includes('slash')) return final
            if (!attacker.spendChan(2)) return final
            const bonus = round1(
                attacker.attrs.get('strength') * 0.1 +
                    attacker.attrs.get('vitality') * 0.1 +
                    attacker.attrs.get('agility') * 0.1 +
                    attacker.attrs.get('dexterity') * 0.1,
            )
            return Math.round((final + bonus) * 10) / 10
        },
    },
    {
        id: 'quick_glance_buff',
        name: '匆匆一瞥',
        description: '暴击伤害提升。',
        tags: ['buff', 'damage'],
        stacking: { type: 'none' },
        onCritDamage: () => 0.25,
    },
    {
        id: 'ru_yi_jin',
        name: '如意劲',
        description: '暴击时消耗3缠，灵巧×3%暴伤。',
        tags: [],
        expiry: { type: 'permanent' },
        onCritDamage: ({ layer }) => {
            const bonus = (layer.extra?.bonus as number) ?? 0
            if (bonus === 0) return 0
            layer.extra = { ...layer.extra, bonus: 0 }
            return bonus
        },
        onCritical: ({ attacker, engine, layer }) => {
            if (!attacker.spendChan(3)) return
            const bonus = round1(attacker.attrs.get('dexterity') * 0.03)
            layer.extra = { ...layer.extra, bonus }
            engine?.emitLog({
                type: 'system',
                message: `[如意劲] ${attacker.name} 消耗3缠，暴伤+${bonus}`,
                actorId: attacker.id,
            })
        },
    },
    {
        id: 'martial_arts_crit',
        name: '武学·破',
        description: '推演出的破绽洞察，每层暴击+1%、爆伤+1%。',
        tags: ['damage'],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive', max: 2 },
        onCritChance: ({ layer }) => layer.restoreValue * 0.02,
        onCritDamage: ({ layer }) => layer.restoreValue * 0.02,
    },
    {
        id: 'blood_thorn_suppress',
        name: '血棘·压制',
        description: '暴击时向创口渡入棘炁，爆伤按 15:1 转化为流血。',
        tags: ['damage'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        // 血棘戒：priority 最高 → 最后结算，读到的 final 是其他钩子处理后的完整伤害
        priority: 99,
        onAfterCritDamage: ({ damage, final, attacker, target, engine, state }) => {
            const extraDamage = final - damage
            const bleedStacks = Math.max(1, Math.round(extraDamage / 15))
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
        description: '触发招式伤害+15。',
        tags: ['damage'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onDealDamage: ({ final, triggered }) => (triggered ? Math.round((final + 15) * 10) / 10 : final),
    },
]
