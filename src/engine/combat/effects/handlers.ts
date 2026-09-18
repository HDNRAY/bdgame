import type { EffectDef } from '../../entities/action'
import type { Character } from '../../entities/character'
import type { BattleEngine } from '../engine'
import type { AttrName } from '../../entities/attributes'
import { calcBaseDamage, calcPreDelayMs, calcHealAmount, calcRoll } from '../../calc/damage'
import { getWeapon } from '../../../data/weapons/weapons'
import { genAppId } from '../../util/buff-utils'
import { notifyRegenChanged, affectsApRegen } from '../utils/ap-regen'
import type { Tag } from '../../entities/tag'
import { scheduleBuffExpiry, removeBuffLayer, executeMove, emitMoveEvents, forEachBuffOf } from '../utils'
import { getBuffMaxOverride, applyStackGainCost } from '../utils/buff-apply'
import { BattleLog } from '../battle-log'
import type { EffectCtx } from './types'
import { MAX_STAT_TRANSFER_LAYERS } from '../../constants'
import type { BuffLayer, ActionResult } from '../types'
import { applyDamage, applyBonusDamage } from './damage'
import { processHitCheck } from './combat'
import { processActionEffect } from './action'
import { tickEngine } from '../tick-engine'
import { scheduleBuffEnd, applyHeal } from '../utils/buff-layer'
import { applyBuffLayer, removeBuffStacks } from '../utils/buff-apply'
import { BuffDef, getBuff } from '../../../data/buffs'

/** 检查目标是否有罡体免疫（通过 buff 的 super_armor 标签识别） */
function hasCcImmunity(target: { id: string }, pendingBuffs: Map<string, BuffLayer>): boolean {
    let immune = false
    forEachBuffOf(pendingBuffs, target.id, (def) => {
        if (def?.tags.includes('super_armor')) {
            immune = true
            return false
        }
    })
    return immune
}

/** 施加 debuff 后的统一收尾：广播 on_debuff、触发自定钩子与 tick 引擎 */
function finishDebuffApply(ctx: {
    engine: BattleEngine
    buffId: string
    buff: BuffDef
    self: Character
    enemy: Character
    stacks: number
    layer: BuffLayer
    layerKey: string
    tMs: number
}): void {
    const { engine, buffId, buff, self, enemy, stacks, layer, layerKey, tMs } = ctx
    // 受害者侧广播（携带 buffId 供 condition.buffId 过滤，如战术腰包「中毒≥4 自动解毒」）
    engine.emit('on_debuff', enemy, self, buffId)
    // debuff 自定钩子（设置 extra 数据）
    buff.onDebuffApply?.({ self, enemy, engine, state: engine.state, stacks, layer, buffId })
    // 攻击者施加 debuff 时回调（遍历攻击者身上的 buff，如血棘·压制对流血目标追击）
    forEachBuffOf(engine.state.pendingBuffs, self.id, (bDef) => {
        bDef?.onDebuffApplied?.({ self, enemy, engine, state: engine.state, stacks, layer, buffId })
    })
    // 后处理（stun/poison/burn 额外逻辑），传入 layer 引用，让 tick engine 可以直接修改 mods
    tickEngine.afterApplyDebuff({ enemy, engine, tMs, buffDef: buff, stacks, layerKey, layer })
}

/**
 * 遍历防御方 buff 的 onReceiveDebuff 钩子，返回本次 debuff 的**实际层数**。
 * 钩子语义（见 `BuffDef.onReceiveDebuff`）：0=完全抵抗，>0=削减到该层数，undefined=不干预；
 * 多个钩子取最小（削减最狠的生效）。完全抵抗时与旧实现一致：记一条抵抗日志并立即停止遍历。
 */
function resolveDebuffStacks(
    engine: BattleEngine,
    buff: BuffDef,
    buffId: string,
    stacks: number,
    self: Character,
    enemy: Character,
): number {
    let final = stacks
    forEachBuffOf(engine.state.pendingBuffs, enemy.id, (bDef) => {
        if (!bDef?.onReceiveDebuff) return
        const result = bDef.onReceiveDebuff({ self: enemy, enemy: self, engine, state: engine.state, buffId, stacks })
        if (result === undefined) return
        if (result === 0) {
            engine.emitLog({
                type: 'system',
                message: `[${bDef.name}] ${enemy.name} 抵抗了${buff.name ?? buffId}`,
                actorId: enemy.id,
            })
            final = 0
            return false
        }
        if (result < final) final = Math.max(1, Math.floor(result))
    })
    return final
}

export const effectHandlers: Record<string, (ctx: EffectCtx) => void> = {
    cleanse({ eff, self, engine }: EffectCtx) {
        const { buffIds, allDebuffs, perDebuffStacks } = eff as Extract<EffectDef, { type: 'cleanse' }>
        const targets = buffIds ?? ['paralyze', 'poison']
        // perDebuffStacks：每类 debuff 减 N 层（additive 减 restoreValue；independent 每种独立计数移除 N 层；其余整体清除）
        // 只净化自己身上的（所有使用者都是 target: 'self'，不过滤会等于资敌）：
        // 走 byOwner 索引只遍历自己的层，并先收集再删，避免边遍历边改。
        const hits: { key: string; buffId: string; layer: BuffLayer }[] = []
        forEachBuffOf(engine.state.pendingBuffs, self.id, (def, layer, buffId, key) => {
            const matches = allDebuffs ? (def?.tags?.includes('debuff') ?? false) : targets.includes(buffId)
            if (matches) hits.push({ key, buffId, layer })
        })
        const left = new Map<string, number>()
        for (const { key: k, buffId, layer } of hits) {
            if (perDebuffStacks && perDebuffStacks > 0) {
                const def = getBuff(buffId)
                if (def?.stacking?.type === 'additive') {
                    // 层数减了，属性修正按「每层请求值 × 新层数」重算（不走比例回退记账）
                    removeBuffStacks(engine.state, k, Math.min(perDebuffStacks, layer.restoreValue))
                    if (layer.restoreValue <= 0) removeBuffLayer(engine, k)
                } else if (def?.stacking?.type === 'independent') {
                    const remain = left.get(buffId) ?? perDebuffStacks
                    if (remain > 0) {
                        removeBuffLayer(engine, k)
                        left.set(buffId, remain - 1)
                    }
                } else {
                    removeBuffLayer(engine, k)
                }
            } else {
                removeBuffLayer(engine, k)
            }
        }
        engine.emitLog({
            type: 'cleanse',
            sourceId: self.id,
            targetId: self.id,
            buffIds: allDebuffs ? undefined : targets,
        })
    },
    heal({ eff, self, engine, action }: EffectCtx) {
        const { value, ratio } = eff as Extract<EffectDef, { type: 'heal' }>
        const amount = calcHealAmount({ baseValue: value, maxHp: self.maxHp, ratio })
        applyHeal(engine, self, amount, action)
    },
    functional_heal({ eff, self, enemy, engine, action }: EffectCtx) {
        const { fn } = eff as Extract<EffectDef, { type: 'functional_heal' }>
        const amount = fn({
            self,
            enemy,
            state: engine.state,
            engine,
            emitLog: (msg) => engine.emitLog({ type: 'system', message: msg, actorId: self.id }),
        })
        applyHeal(engine, self, amount, action)
    },
    knockback({ eff, enemy, engine }: EffectCtx) {
        // 击退目标是受击方（enemy）——推掌「推开对手」等；罡体免疫也检查目标
        if (hasCcImmunity(enemy, engine.state.pendingBuffs)) {
            engine.emitLog({ type: 'system', message: `[罡体] ${enemy.name} 免疫击退`, actorId: enemy.id })
            return
        }
        const { distance } = eff as Extract<EffectDef, { type: 'knockback' }>
        // knockback 的位移量以敌方相对距离为准：distance>0 表示把目标推开 distance 米
        if (distance > 0) executeMove(enemy, engine, distance, 0, { blink: true })
    },
    ciyuan_init({ self, engine }: EffectCtx) {
        const weapon = self.weaponDef ?? getWeapon(self.build.weapon)
        if (weapon.id === 'bare_hands') {
            // 走 switch_weapon 流程以确保 passiveTriggers / 武器自带 buff 等正确
            processActionEffect(
                { type: 'switch_weapon', weaponId: 'ciyuan_blade' },
                { self, enemy: self, engine, tMs: engine.state.turn.currentTime },
            )
            engine.emitLog({
                type: 'system',
                message: BattleLog.msg('灵剑', self.name, '凝炁为刃'),
                actorId: self.id,
            })
        } else {
            const newMax = Math.max(3, weapon.range[1])
            // 走 weaponPatch：weaponDef 是派生值，直接写会被下一次 rebuildDerived() 抹掉
            self.patchWeapon({ tags: ['qi' as Tag], range: [weapon.range[0], newMax] })
            engine.emitLog({
                type: 'system',
                message: BattleLog.msg('附炁与刃', self.name, `附炁成功，射程扩展至${newMax}`),
                actorId: self.id,
            })
        }
        engine.state.pendingBuffs.set(`ciyuan_blade::${self.id}`, { restoreValue: 1 })
    },
    functional_damage({ eff, self, enemy, engine, action, triggered }: EffectCtx) {
        const { fn, piercing = 0 } = eff as Extract<EffectDef, { type: 'functional_damage' }>
        const dmg = fn({
            self,
            enemy,
            state: engine.state,
            engine,
            emitLog: (msg) => engine.emitLog({ type: 'system', message: msg, actorId: self.id }),
        })
        if (dmg > 0) {
            applyDamage({ raw: dmg, target: enemy, attacker: self, engine, source: action, piercing, triggered })
        }
    },
    damage({ eff, self, enemy, engine, action, triggered }: EffectCtx) {
        const { scaling, fixed = 0, independentHits = 1, piercing = 0 } = eff as Extract<EffectDef, { type: 'damage' }>
        // 固定伤害 + 属性缩放（可叠加；纯固定伤害无 scaling）
        const raw = (scaling ? calcBaseDamage(scaling, self.attrs.getAll(), 0) : 0) + fixed
        if (raw <= 0) return
        if (independentHits <= 1) {
            applyDamage({ raw, target: enemy, attacker: self, engine, source: action, piercing, triggered })
            return
        }
        // 多段独立命中判定（只有最后一段触发触发器，防止一次攻击连触发多次）
        for (let i = 0; i < independentHits; i++) {
            const r: ActionResult = {
                damage: 0,
                hit: false,
                parried: false,
                dodged: false,
                crit: false,
                distanceDelta: 0,
            }
            const isLast = i === independentHits - 1
            if (!processHitCheck(action!, r, self, enemy, engine, !isLast)) continue
            if (r.dodged) continue
            applyDamage({
                raw,
                target: enemy,
                attacker: self,
                engine,
                source: action,
                piercing,
                suppressTriggers: !isLast,
                triggered,
            })
        }
    },
    self_damage({ eff, self, engine }: EffectCtx) {
        const { ratio } = eff as Extract<EffectDef, { type: 'self_damage' }>
        const dmg = Math.round(self.maxHp * ratio)
        // spendHp：自伤触发 onHpChange（血战到底等联动），但不回缠
        self.spendHp(dmg, engine)
        engine.emitLog({
            type: 'damage',
            actionId: '_self_damage',
            actionName: '自伤',
            sourceId: self.id,
            targetId: self.id,
            base: dmg,
            final: dmg,
            blocked: 0,
            isCrit: false,
            isParried: false,
            tags: ['self_damage'],
        })
    },
    self_hp_cost({ eff, self, engine }: EffectCtx) {
        // 血引类：按当前气血比例扣（pre-hit，miss 也耗血）
        const { ratio } = eff as Extract<EffectDef, { type: 'self_hp_cost' }>
        const cost = Math.round(self.hp * ratio)
        if (cost <= 0) return
        // spendHp：卖血触发 onHpChange（血战到底联动），但不回缠（自伤不走受击回缠）
        self.spendHp(cost, engine)
        engine.emitLog({
            type: 'system',
            message: `[操血] ${BattleLog.name(self.name)} 消耗${cost}气血`,
            actorId: self.id,
        })
    },
    missing_hp_damage({ eff, self, enemy, engine, action, triggered }: EffectCtx) {
        const { ratio } = eff as Extract<EffectDef, { type: 'missing_hp_damage' }>
        const dmg = Math.round((enemy.maxHp - enemy.hp) * ratio)
        if (dmg > 0) {
            applyBonusDamage({
                raw: dmg,
                target: enemy,
                attacker: self,
                engine,
                source: action,
                label: '崩劲',
                labelId: 'missing_hp_damage',
                triggered,
            })
        }
    },
    self_missing_hp_damage({ eff, self, enemy, engine, action, triggered }: EffectCtx) {
        const { ratio } = eff as Extract<EffectDef, { type: 'self_missing_hp_damage' }>
        const dmg = Math.round((self.maxHp - self.hp) * ratio)
        if (dmg > 0) {
            applyBonusDamage({
                raw: dmg,
                target: enemy,
                attacker: self,
                engine,
                source: action,
                label: '黯然',
                labelId: 'self_missing_hp_damage',
                triggered,
            })
        }
    },

    // ── 自效果（无需命中判定） ──
    stat_multiply({ eff, self, engine, tMs }: EffectCtx) {
        const e = eff as Extract<EffectDef, { type: 'stat_multiply' }>
        const appId = genAppId(tMs)
        const layerKey = `stat_multiply::${self.id}::${appId}`
        const attr = e.stat as AttrName
        const old = self.attrs.get(attr)
        self.attrs.set(attr, old * e.multiplier)
        // 实际生效量只用于日志；层里记的是「倍率」本身，重算时按乘回放（不是记一个夹取后的差值）
        const actual = self.attrs.get(attr) - old
        engine.emitLog({
            type: 'stat_change',
            targetId: self.id,
            attr: e.stat,
            delta: actual,
            label: getBuff('stat_multiply')?.name ?? '超越',
        })
        engine.state.pendingBuffs.set(layerKey, {
            buffId: 'stat_multiply',
            restoreValue: old, // 仅供展示/调试：施法前的属性值
            modsMultiply: { [e.stat]: e.multiplier },
        })
        scheduleBuffEnd(engine, layerKey, getBuff('stat_multiply')!, self)
    },
    restore_ap({ eff, self, engine }: EffectCtx) {
        const e = eff as Extract<EffectDef, { type: 'restore_ap' }>
        self.gainAp(e.value)
        engine.emitLog({ type: 'system', message: BattleLog.msg('回炁', self.name, `AP+${e.value}`), actorId: self.id })
    },
    max_ap_mod({ eff, self }: EffectCtx) {
        // 御物武器占用 AP 上限（开局 battle_start 槽）：maxApMod 直接累加，改上限后夹住当前 AP
        const e = eff as Extract<EffectDef, { type: 'max_ap_mod' }>
        self.maxApMod += e.value
        self.capAp()
    },
    stat_transfer({ eff, self, enemy, engine, tMs }: EffectCtx) {
        const e = eff as Extract<EffectDef, { type: 'stat_transfer' }>
        const attr = e.stat as AttrName
        // 汲取层数上限（MAX_STAT_TRANSFER_LAYERS=4）：同一施法者最多同时 4 层，防高频汲灵/北冥无限叠加
        const max = MAX_STAT_TRANSFER_LAYERS
        let layers = 0
        forEachBuffOf(engine.state.pendingBuffs, self.id, (_def, _layer, buffId) => {
            if (buffId === 'stat_transfer') layers++
        })
        if (layers >= max) {
            engine.emitLog({
                type: 'system',
                message: `[汲取] ${self.name} 汲取已达上限（${max}层）`,
                actorId: self.id,
            })
            return
        }
        const before = enemy.attrs.get(attr)
        enemy.attrs.modify(attr, -e.value)
        // 实际扣减量（可能因属性下限 ATTR_MIN 被夹住而小于请求值）
        const actual = before - enemy.attrs.get(attr)
        if (actual <= 0) return // 目标属性已在下限，未能汲取，不产生效果/日志

        const appId = genAppId(tMs)
        const layerKey = `stat_transfer::${self.id}::${appId}`

        self.attrs.modify(attr, actual)
        engine.emitLog({ type: 'stat_change', targetId: enemy.id, attr: e.stat, delta: -actual, label: '汲取' })
        engine.state.pendingBuffs.set(layerKey, {
            buffId: 'stat_transfer',
            restoreValue: actual,
            targetId: enemy.id,
            mods: { [e.stat]: actual },
            modsPerStack: { [e.stat]: actual },
        })
        scheduleBuffExpiry(engine, layerKey, e.duration)
        // 被汲取方也要留一条同寿命的条目：否则它一重算（被偷奇物/换武）就把掉掉的属性长回来
        engine.state.pendingBuffs.set(`stat_transfer_drain::${enemy.id}::${appId}`, {
            buffId: 'stat_transfer',
            restoreValue: 1,
            mods: { [e.stat]: -e.value },
        })
        scheduleBuffExpiry(engine, `stat_transfer_drain::${enemy.id}::${appId}`, e.duration)

        if (e.stat === 'vitality') {
            self.capAp()
            enemy.capAp()
        }
    },
    add_debuff({ eff, self, enemy, engine, tMs }: EffectCtx) {
        const e = eff as Extract<EffectDef, { type: 'add_debuff' }>
        const buff = getBuff(e.buffId)
        if (!buff) return

        // 每层独立判定概率：roll stacks 次，成功次数=总叠层（stacks:5/chance:0.8 → 0~5 分布，期望 5×0.8）
        const rollCount = e.stacks ?? 1
        let stacks = 0
        for (let i = 0; i < rollCount; i++) {
            if (calcRoll(e.chance).success) stacks++
        }
        if (stacks <= 0) return

        // 防御方 buff 的 onReceiveDebuff 钩子（概率抵抗 / 层数削减）：完全抵抗则本次作废，>0 则削减到该层数
        stacks = resolveDebuffStacks(engine, buff, e.buffId, stacks, self, enemy)
        if (stacks <= 0) return

        // 统一核心：叠层/建层、上限、属性缩放、过期调度全部在此完成
        const r = applyBuffLayer(engine, {
            buff,
            target: enemy,
            stacks,
            tMs,
            sourceId: self.id,
            max: buff.stacking?.type === 'additive' ? (buff.stacking.max ?? Infinity) : Infinity,
            capFirstApply: true,
        })

        // 不可叠层已存在 → 记「已存在」；已达上限/被拦截 → 静默
        if (r.noop) {
            if (r.noop === 'none_exists') {
                engine.emitLog({ type: 'system', message: `[${buff.name}] ${enemy.name} 已存在`, actorId: enemy.id })
            }
            return
        }

        // 日志（stun 的 attrMods 由 afterApplyDebuff 输出，此处不重复）
        if (e.buffId !== 'stun') {
            const layer = r.layer!
            const stackLabel = r.added > 1 ? ` ×${r.added}` : ''
            const applyMsg = buff.logFormat?.(layer, enemy.name)
            const base = `[${buff.name ?? e.buffId}] `
            const msg = r.created
                ? applyMsg
                    ? `${base}${applyMsg}`
                    : r.modsDetails.length
                      ? `${BattleLog.buffApply(buff.name ?? e.buffId, enemy.name, buff.description)}${stackLabel} ${r.modsDetails.join(', ')}`
                      : `${BattleLog.buffApply(buff.name ?? e.buffId, enemy.name, buff.description)}${stackLabel}`
                : applyMsg
                  ? `${base}${applyMsg}`
                  : r.modsDetails.length
                    ? `${BattleLog.buffApply(buff.name ?? e.buffId, enemy.name)} Lv.${layer.restoreValue}（${r.modsDetails.join(', ')}）`
                    : `${BattleLog.buffApply(buff.name ?? e.buffId, enemy.name)} Lv.${layer.restoreValue}`
            engine.emitLog({ type: 'system', message: msg, actorId: enemy.id })
        }

        // 统一收尾：广播 on_debuff + 自定钩子（数据内声明，如 bleed 广播 on_bleed）+ tick 引擎
        finishDebuffApply({
            engine,
            buffId: e.buffId,
            buff,
            self,
            enemy,
            stacks,
            layer: r.layer!,
            layerKey: r.key,
            tMs,
        })
    },
    add_buff({ eff, self, engine, tMs }: EffectCtx) {
        const e = eff as Extract<EffectDef, { type: 'add_buff' }>
        const buff = getBuff(e.buffId)
        if (!buff) return

        // 架势自动替换：新架势静默覆盖旧架势（回退旧属性、移除旧层）
        let replacedStance = false
        let oldStanceName = ''
        const staleStanceKeys: string[] = []
        if (buff.tags?.includes('stance')) {
            forEachBuffOf(engine.state.pendingBuffs, self.id, (existing, _layer, buffId, key) => {
                if (buffId === e.buffId) return
                if (existing?.tags.includes('stance')) {
                    oldStanceName = existing.name ?? buffId
                    // 撤旧架势 = 删层 + 重算（无逆运算）；遍历中不能改表，先收集
                    staleStanceKeys.push(key)
                    replacedStance = true
                    return false
                }
            })
        }

        for (const k of staleStanceKeys) removeBuffLayer(engine, k)

        // 统一核心：叠层/建层、上限覆盖(onBuffApply)、资源门槛(onStackGain)、属性缩放全部在此完成
        const r = applyBuffLayer(engine, {
            buff,
            target: self,
            stacks: e.stacks ?? 1,
            tMs,
            max: getBuffMaxOverride(buff, engine, self.id),
            stackGate: (delta) => applyStackGainCost(engine, self, e.buffId, delta),
            // 保留历史行为：additive 首次建层不按上限截断（如 zhou stacks:2 > max:1）
            capFirstApply: false,
        })
        // 幂等（none 已存在）/ 已达上限 / 资源不足 → 静默
        if (r.noop) return

        // 日志
        const label = buff.name ?? e.buffId
        engine.emitLog({
            type: 'system',
            message: r.created
                ? replacedStance
                    ? `切换架势: ${oldStanceName} → ${label}`
                    : r.modsDetails.length
                      ? `${BattleLog.buffApply(label, self.name, buff.description)} ${r.modsDetails.join(', ')}${buff.stacking?.type === 'additive' ? ` Lv.${r.added}${buff.stacking?.max ? `/${buff.stacking.max}` : ''}` : ''}${buff.stacking?.type === 'independent' ? ` 第${r.totalIndependent}层` : ''}`
                      : `${BattleLog.buffApply(label, self.name, buff.description)}${buff.stacking?.type === 'additive' ? ` Lv.${r.added}${buff.stacking?.max ? `/${buff.stacking.max}` : ''}` : ''}${buff.stacking?.type === 'independent' ? ` 第${r.totalIndependent}层` : ''}`
                : `${BattleLog.buffApply(label, self.name)} Lv.${r.layer!.restoreValue}${r.max < Infinity ? `/${r.max}` : ''}`,
            actorId: self.id,
        })

        // 事件广播 + 资源回复重算
        const opponent = engine.state.characters.find((c) => c.id !== self.id)!
        engine.emit('on_buff', self, opponent, e.buffId)
        if (buff.tags?.includes('stance')) engine.emit('on_stance', self, opponent, e.buffId)
        if (affectsApRegen(e.buffId)) notifyRegenChanged(engine.state, self)
    },
    remove_buff({ eff, self, engine }: EffectCtx) {
        const e = eff as Extract<EffectDef, { type: 'remove_buff' }>
        const key = `${e.buffId}::${self.id}`
        const layer = engine.state.pendingBuffs.get(key)
        if (!layer) return

        if (e.stacks != null && layer.restoreValue > e.stacks) {
            const delta = -e.stacks
            if (delta < 0) {
                // 部分移除：层数减 N，属性按每层请求值重算
                removeBuffStacks(engine.state, key, -delta)
                if (e.buffId !== 'disarmed') {
                    engine.emitLog({
                        type: 'system',
                        message: `${getBuff(e.buffId)?.name ?? e.buffId} ${self.name} ${-delta}层→${layer.restoreValue}层`,
                        actorId: self.id,
                    })
                }
                if (affectsApRegen(e.buffId)) notifyRegenChanged(engine.state, self)
            }
            return
        }

        const oldStacks = layer.restoreValue
        removeBuffLayer(engine, key)
        if (affectsApRegen(e.buffId)) notifyRegenChanged(engine.state, self)
        const buffName = getBuff(e.buffId)?.name ?? e.buffId
        if (e.buffId !== 'disarmed') {
            engine.emitLog({
                type: 'system',
                message:
                    oldStacks > 1
                        ? `[${buffName}] ${BattleLog.name(self.name)} 状态消失（${oldStacks}层）`
                        : BattleLog.buffRemove(buffName, self.name),
                actorId: self.id,
            })
        }
    },
    short_dash({ eff, self, engine, action }: EffectCtx) {
        const e = eff as Extract<EffectDef, { type: 'short_dash' }>
        const opponent = engine.getOpponent(self.id)!
        const dist = engine.state.position.distance(self.id, opponent.id)
        // 触发招式（闪避/招架反击等）带 short_dash = 冲过去打：总是冲近贴脸，不做"已在射程内"判断
        const isTriggered = action?.tags?.includes('trigger')
        if (!isTriggered) {
            // 主招式 short_dash：双向垫步——太远前冲、太近（贴脸够不到下限）后撤到射程内。
            // 下限~上限之间已能打到，不冲。
            const effRange = self.getEffectiveRange()
            if (effRange) {
                const [lo, hi] = effRange
                const maxDash = e.maxDistance ?? 2
                if (dist > hi) {
                    // 前冲 min(超出量, dash)，落到射程内
                    const push = Math.min(dist - hi, maxDash)
                    const pre = calcPreDelayMs(
                        self.attrs.get('agility'),
                        action?.extraPreDelay ?? 0,
                        self.getHaste(engine.state),
                    )
                    executeMove(self, engine, -push, 0, { durationMs: pre, kind: 'short_dash' })
                } else if (dist < lo) {
                    // 后撤 min(不足量, dash)，退到射程下限够得着
                    const back = Math.min(lo - dist, maxDash)
                    const pre = calcPreDelayMs(
                        self.attrs.get('agility'),
                        action?.extraPreDelay ?? 0,
                        self.getHaste(engine.state),
                    )
                    executeMove(self, engine, back, 0, { durationMs: pre, kind: 'short_dash' })
                }
                return
            }
        }
        const maxDash = e.maxDistance ?? 2
        const targetDist = Math.max(0, dist - maxDash)
        const delta = dist - targetDist
        // short_dash 占用前摇窗口：位置在 [0, 前摇] 内平滑插值（不闪烁）
        const pre = calcPreDelayMs(self.attrs.get('agility'), action?.extraPreDelay ?? 0, self.getHaste(engine.state))
        executeMove(self, engine, -delta, 0, { durationMs: pre, kind: 'short_dash' })
    },
    // step_back：命中后自身向远离对手方向退 distance 米（对掌弹开、拉开距离类）。
    // executeMove delta>0 = 远离；不占前摇（命中后结算，effect 顺序排在 damage/knockback 之后即可）
    step_back({ eff, self, engine }: EffectCtx) {
        const { distance = 1 } = eff as Extract<EffectDef, { type: 'step_back' }>
        if (distance <= 0) return
        executeMove(self, engine, distance, 0, { kind: 'move' })
    },
    dash({ eff, self, engine, action }: EffectCtx) {
        const e = eff as Extract<EffectDef, { type: 'dash' }>
        const opponent = engine.getOpponent(self.id)!
        const dist = engine.state.position.distance(self.id, opponent.id)
        // maxRange = 最大位移距离（朝 targetDist 位移，最多 maxRange 米），不再是对手距离门槛
        const minTravel = e.minRange ?? 0
        const maxTravel = e.maxRange ?? Infinity
        const targetDist = e.targetDist < 0 ? self.getMaxActionRange(engine.state) : e.targetDist
        // 期望位移（正=靠近，负=远离）
        const desired = dist - targetDist
        if (desired === 0) return
        // 期望位移不足最小要求 → 本次位移作废（如虎跃需至少 2m 才跳）
        if (Math.abs(desired) < minTravel) {
            engine.emitLog({ type: 'system', message: BattleLog.plain(self.name, '距离不合适'), actorId: self.id })
            return
        }
        // 实际位移 = 朝目标方向，最多 maxTravel
        const travel = Math.sign(desired) * Math.min(Math.abs(desired), maxTravel)
        if (e.useAp) {
            const apCost = Math.max(1, Math.ceil(Math.abs(travel) * 0.4))
            if (self.ap < apCost) {
                // engine.emitLog({ type: 'system', message: `${self.name} AP不足`, actorId: self.id })
                return
            }
            self.spendAp(apCost)
            const p = engine.state.position
            const actualDelta = p.moveToward(self.id, opponent.id, -travel)
            emitMoveEvents(engine, self, opponent, actualDelta)
            engine.emitLog({
                type: 'move',
                sourceId: self.id,
                delta: actualDelta,
                newDistance: p.distance(self.id, opponent.id),
                apCost,
                apRemaining: self.ap,
                blink: true,
                kind: 'dash',
                actionName: action?.name,
            })
        } else {
            if (travel !== 0)
                executeMove(self, engine, -travel, 0, { blink: true, kind: 'dash', actionName: action?.name })
        }
    },
    disarm({ eff, self, enemy, engine, action }: EffectCtx) {
        if (hasCcImmunity(enemy, engine.state.pendingBuffs)) {
            engine.emitLog({ type: 'system', message: `[罡体] ${enemy.name} 免疫缴械`, actorId: enemy.id })
            return
        }
        const e = eff as Extract<EffectDef, { type: 'disarm' }>
        let chance = e.chance ?? 1
        // 防御方 buff 缴械抗性
        forEachBuffOf(engine.state.pendingBuffs, enemy.id, (def, layer) => {
            if (!def?.onDisarmChance) return
            chance += def.onDisarmChance({
                final: 0,
                raw: 0,
                attacker: self,
                target: enemy,
                engine,
                state: engine.state,
                layer,
                source: action,
            })
        })
        chance = Math.max(0, Math.min(1, chance))
        if (chance < 1) {
            const { success } = calcRoll(chance)
            if (!success) return
        }
        const oldWeapon = enemy.weaponDef ?? getWeapon(enemy.build.weapon)
        if (oldWeapon.id === 'bare_hands') return
        // 御物武器免疫缴械
        if (oldWeapon.tags.includes('imperial')) return
        const key = `disarmed::${enemy.id}`
        if (engine.state.pendingBuffs.has(key)) return

        // 记录掉落位置（缴对手武器掉原地）
        const dropPosition = engine.state.position.get(enemy.id)
        enemy.setWeapon('bare_hands', engine)
        engine.state.pendingBuffs.delete(`ciyuan_blade::${enemy.id}`)
        engine.state.pendingBuffs.set(key, { restoreValue: 1, extra: { originalWeapon: oldWeapon.id, dropPosition } })
        engine.emitLog({
            type: 'system',
            message: `[${action?.name ?? '点腕'}] ${BattleLog.name(enemy.name)} 兵器脱手！`,
            actorId: enemy.id,
        })
        engine.emit('on_disarm', self, enemy)
        engine.emit('on_disarmed', enemy, self)
    },
    self_disarm({ self, engine, action, eff }: EffectCtx) {
        const oldWeapon = self.weaponDef ?? getWeapon(self.build.weapon)
        if (oldWeapon.id === 'bare_hands') return
        if (oldWeapon.tags.includes('imperial')) return
        if (engine.state.pendingBuffs.has(`disarmed::${self.id}`)) return

        // 保存原始武器信息
        const originalWeapon = oldWeapon.id
        // self_disarm 声明 dropAt:'opponent'（燎天势顺势脱手）：武器飞向对手所在位置；默认掉自己脚边
        const e = eff as Extract<EffectDef, { type: 'self_disarm' }>
        const opponent = engine.getOpponent(self.id)
        const dropPosition =
            e.dropAt === 'opponent' && opponent
                ? engine.state.position.get(opponent.id)
                : engine.state.position.get(self.id)

        // 换空手（复用已有 handler）
        processActionEffect(
            { type: 'switch_weapon', weaponId: 'bare_hands' },
            { self, enemy: self, engine, tMs: engine.state.turn.currentTime },
        )

        // 设置 disarmed buff 层
        engine.state.pendingBuffs.set(`disarmed::${self.id}`, {
            restoreValue: 1,
            extra: { originalWeapon, dropPosition },
        })

        engine.emitLog({
            type: 'system',
            message: `[${action?.name ?? '自缴械'}] ${BattleLog.name(self.name)} 兵器脱手！`,
            actorId: self.id,
        })

        engine.emit('on_disarm', self, self)
        if (opponent) {
            engine.emit('on_disarmed', self, opponent)
            engine.emit('on_disarmed', opponent, self)
        }
    },
    // add_passive removed — use add_buff directly
    steal_artifact({ self, engine }: EffectCtx) {
        const enemy = engine.getOpponent(self.id)
        if (!enemy) return
        // 找对手可偷的奇物（非 inherent）
        const stealable = enemy.artifactDefs.filter(
            (a) => !a.tags.includes('inherent') && !a.tags.includes('implant') && !a.tags.includes('imperial'),
        )
        if (stealable.length === 0) {
            engine.emitLog({ type: 'system', message: `[探云手] 对手无可偷取奇物`, actorId: self.id })
            return
        }
        // 成功概率（初始 60%，成功后减半）
        const trackKey = `steal_artifact_track::${self.id}`
        const track = engine.state.pendingBuffs.get(trackKey)
        const chance = track?.restoreValue ?? 0.6
        const { success } = calcRoll(chance)
        if (!success) {
            engine.emitLog({
                type: 'system',
                message: `[探云手] 失手！(${Math.round(chance * 100)}%)`,
                actorId: self.id,
            })
            return
        }
        // 偷取第一个可偷奇物
        const target = stealable[0]
        const idx = enemy.artifactDefs.indexOf(target)
        if (idx !== -1) enemy.artifactDefs.splice(idx, 1)
        // 撤销奇物给对手带来的构造期修正（属性/上限/触发槽/武器 tag —— 来源层账）
        enemy.removeSource(`artifact:${target.id}`, engine.state)
        // 撤销奇物触发挂上的 buff（触发槽里 add_buff 的奇物，如静心符的 on_stance 层）
        const grantedBuffs = new Set<string>()
        for (const t of target.triggers ?? []) {
            for (const e of t.effects ?? []) {
                if (e.type === 'add_buff' && e.buffId) grantedBuffs.add(e.buffId)
            }
        }
        if (grantedBuffs.size > 0) {
            const keys: string[] = []
            forEachBuffOf(engine.state.pendingBuffs, enemy.id, (_def, _layer, buffId, key) => {
                if (grantedBuffs.has(buffId)) keys.push(key)
            })
            for (const k of keys) removeBuffLayer(engine, k)
        }
        // 撤销奇物触发里「直接改角色字段」的效果（目前只有 max_ap_mod：分身球占内息上限）
        // 这类效果还没走层账，属于本轮的已知遗留；将来把它也做成层就不需要这段反函数。
        for (const t of target.triggers ?? []) {
            for (const e of t.effects ?? []) {
                if (e.type === 'max_ap_mod') {
                    enemy.maxApMod -= e.value
                    enemy.capAp()
                }
            }
        }
        // 移除对手的奇物 triggers
        for (const t of target.triggers ?? []) {
            const tIdx = enemy.passiveTriggers.indexOf(t)
            if (tIdx !== -1) enemy.passiveTriggers.splice(tIdx, 1)
        }
        // 移除奇物赋予的招式（酒被偷走 → 不能再喝）
        enemy.removeActionsByIds(target.grantsActions ?? [])
        // 加给自己（含奇物赋予的招式：偷来的酒能喝）
        const originId = `artifact:${target.id}`
        // 幂等：同来源旧层先按 originId 清掉（bySource 索引），再让 addArtifact 重新物化
        for (const k of engine.state.pendingBuffs.keysOfOrigin(originId)) removeBuffLayer(engine, k)
        self.addArtifact(target.id, engine)
        // 给「这件奇物挂上的层」打来源标记，便于后续按来源整体撤销（缴械/被偷回等）
        const granted = new Set(grantedBuffs)
        for (const k of granted.size > 0 ? [...engine.state.pendingBuffs.keys()] : []) {
            if (!k.endsWith(`::${self.id}`)) continue
            const buffId = k.slice(0, k.indexOf('::'))
            if (granted.has(buffId)) engine.state.pendingBuffs.tagOrigin(k, originId)
        }
        // 更新成功概率（减半）
        engine.state.pendingBuffs.set(trackKey, { restoreValue: chance / 2 })
        engine.emitLog({
            type: 'system',
            message: `[探云手] 得手！偷取了「${target.name}」（下次${Math.round((chance / 2) * 100)}%）`,
            actorId: self.id,
        })
    },
    switch_weapon({ eff, self, engine }: EffectCtx) {
        const e = eff as Extract<EffectDef, { type: 'switch_weapon' }>

        // const oldWeaponName = (self.weaponDef ?? getWeapon(self.build.weapon)).name
        // 账里换武器：撤旧来源层（属性/武器 tag/自带 buff 一起撤）→ 挂新来源层 → 物化
        self.setWeapon(e.weaponId, engine)
        // 广播武器变更事件（让被动如行云流水切换架势）
        engine.emit('on_weapon_change', self, self)
    },
    retrieve_weapon({ self, engine }: EffectCtx) {
        const key = `disarmed::${self.id}`
        const layer = engine.state.pendingBuffs.get(key)
        const weaponId = layer?.extra?.originalWeapon as string | undefined
        if (!weaponId) {
            console.error('retrieve_weapon: missing originalWeapon')
            return
        }
        // 1. 切回原武器 → 物化武器自带 buff
        processActionEffect(
            { type: 'switch_weapon', weaponId },
            { self, enemy: self, engine, tMs: engine.state.turn.currentTime },
        )
        // 2. 移除缴械
        const removeEff: EffectDef = { type: 'remove_buff', buffId: 'disarmed' }
        processActionEffect(removeEff, { self, enemy: self, engine, tMs: engine.state.turn.currentTime })
    },
}
