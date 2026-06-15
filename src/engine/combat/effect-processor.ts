import type { Character } from '../entities/character'
import type { BattleEngine } from './engine'
import type { EffectDef, ActionDefinition } from '../entities/action'
import type { AttrName } from '../entities/attributes'
import type { StatusType } from '../entities/status'
import {
    calcBaseDamage,
    calcCritChance,
    calcFinalDamage,
    calcPoisonTickInterval,
    calcBuffDuration,
    calcHealAmount,
    calcParriedDamage,
    calcHitChance,
    calcParryChance,
    calcRoll,
    calcStunAttrRatio,
    calcStunAttrDelta,
    calcDebuffDuration,
} from '../calc/damage'
import { getWeapon } from '../data/weapons'
import { getBuff } from '../data/buffs'
import { getAction } from '../data/actions'
import { genAppId } from '../util/buff-utils'
import { triggerBleed } from '../entities/status'
import type { Tag } from '../entities/tag'
import { BattleLog } from './battle-log'
import { scheduleBuffExpiry, revertBuffMods, revertWeaponStatBuffs, clearWeaponBuffLayers, executeMove } from './utils'
import type { ActionResult, BuffLayer } from './types'

// ── Context 类型 ──
interface EffectCtx {
    eff: EffectDef
    self: Character
    enemy: Character
    engine: BattleEngine
    tMs: number
    action?: ActionDefinition
}

// ── 效果分发表 ──

/** 应用伤害（含招架判定） */
function applyDamage(
    raw: number,
    target: Character,
    attacker: Character,
    engine: BattleEngine,
    actionDef?: ActionDefinition,
): void {
    const act = actionDef
    const { parried, final: afterParry } = resolveParry(raw, target, attacker, engine, act)
    const blocked = raw - afterParry
    const { isCrit, final: afterCrit } = resolveCrit(afterParry, raw, target, attacker, engine, act)
    const final = applyDamageModifiers(afterCrit, target, attacker, engine, raw, actionDef)

    target.takeDamage(final)

    if (final > 0) {
        engine.emit('on_dealt_damage', attacker, target)
        engine.emit('on_took_damage', target, attacker)
    }

    engine.emitLog({
        type: 'damage',
        actionId: actionDef?.id ?? 'unknown',
        actionName: actionDef?.name ?? '未知',
        sourceId: attacker.id,
        targetId: target.id,
        base: raw,
        final,
        blocked,
        isCrit,
        isParried: parried,
        tags: [],
    })
    if (isCrit) engine.emit('on_crit', attacker, target)
}

/** 招架判定：是否招架 + 招架后伤害 */
function resolveParry(
    raw: number,
    target: Character,
    attacker: Character,
    engine: BattleEngine,
    act: ActionDefinition | undefined,
): { parried: boolean; final: number } {
    // ── 1. 能否招架 ──
    const weapon = target.weaponDef ?? getWeapon(target.build.weapon)
    const hasParryTag = weapon.tags.includes('parry')
    const hasParryBuff = [...engine.state.pendingBuffs].some(([k]) => {
        const parts = k.split('::')
        if (parts.length < 2 || parts[1] !== target.id) return false
        return getBuff(parts[0])?.onCanParry?.({ self: target, engine }) ?? false
    })
    if (!hasParryTag && !hasParryBuff) return { parried: false, final: raw }

    // ── 2. 招架概率 ──
    let pc = calcParryChance(0, target.attrs.get('dexterity'), target.attrs.get('insight'))
    if (target.parryMod) {
        pc = Math.min(0.95, pc + target.parryMod)
    }
    if (act) {
        for (const [key, layer] of engine.state.pendingBuffs) {
            const parts = key.split('::')
            if (parts.length < 2 || parts[1] !== target.id) continue
            const def = getBuff(parts[0])
            if (!def?.onParryChance) continue
            const bonus = def.onParryChance({
                final: raw,
                raw,
                target,
                attacker,
                engine,
                buffOwnerId: parts[1],
                layer,
                action: act,
            })
            pc = Math.min(0.95, pc + bonus)
        }
    }

    // ── 3. 摇奖 ──
    const { success: parried, roll } = calcRoll(pc)
    engine.emitLog({
        type: 'check_parry',
        sourceId: attacker.id,
        targetId: target.id,
        parryChance: pc,
        roll,
        result: parried,
    })
    if (!parried) return { parried: false, final: raw }

    // ── 4. 消耗消费型 buff（看破等） ──
    for (const [k] of engine.state.pendingBuffs) {
        if (k.endsWith(`::${target.id}`)) {
            const def = getBuff(k.split('::')[0])
            if (def?.expiry?.type === 'consumed') engine.state.pendingBuffs.delete(k)
        }
    }
    engine.emit('on_parry', target, attacker)

    // ── 5. 伤害减免 ──
    let final = calcParriedDamage(raw, target.attrs.get('strength'))
    if (act) {
        for (const [key, layer] of engine.state.pendingBuffs) {
            const parts = key.split('::')
            if (parts.length < 2 || parts[1] !== target.id) continue
            const def = getBuff(parts[0])
            if (!def?.onParryReduction) continue
            final = def.onParryReduction({
                final,
                raw,
                target,
                attacker,
                engine,
                buffOwnerId: parts[1],
                layer,
                action: act,
            })
        }
    }
    final = Math.round(final * 10) / 10
    return { parried: true, final }
}

/** 暴击判定：是否暴击 + 暴击后伤害 */
function resolveCrit(
    damage: number,
    raw: number,
    target: Character,
    attacker: Character,
    engine: BattleEngine,
    act: ActionDefinition | undefined,
): { isCrit: boolean; final: number } {
    let bonus = attacker.critChance
    for (const [key, layer] of engine.state.pendingBuffs) {
        const parts = key.split('::')
        if (parts.length < 2 || parts[1] !== attacker.id) continue
        if (!act) break
        const def = getBuff(parts[0])
        if (def?.onCritChance)
            bonus += def.onCritChance({
                final: damage,
                raw,
                target,
                attacker,
                engine,
                buffOwnerId: parts[1],
                layer,
                action: act,
            })
    }
    const critChance = calcCritChance(attacker.attrs.get('dexterity'), attacker.attrs.get('insight'), bonus)
    const critRoll = calcRoll(critChance)
    const isCrit = critRoll.success
    engine.emitLog({ type: 'check_crit', sourceId: attacker.id, critChance, roll: critRoll.roll, result: isCrit })
    const final = calcFinalDamage(damage, 1, isCrit, attacker.critDamageMod)
    return { isCrit, final: Math.round(final * 10) / 10 }
}

const effectHandlers: Record<string, (ctx: EffectCtx) => void> = {
    cleanse({ eff, self, engine }: EffectCtx) {
        const { statuses } = eff as Extract<EffectDef, { type: 'cleanse' }>
        const targets = statuses ?? (['paralyze', 'poison'] as StatusType[])
        for (const [k] of engine.state.pendingBuffs) {
            const [prefix] = k.split('::')
            if (targets.includes(prefix as StatusType)) {
                engine.state.pendingBuffs.delete(k)
            }
        }
        engine.emitLog({ type: 'cleanse', sourceId: self.id, targetId: self.id, statuses: targets })
    },
    heal({ eff, self, engine }: EffectCtx) {
        const { value, ratio } = eff as Extract<EffectDef, { type: 'heal' }>
        const amount = calcHealAmount(value, self.maxHp, ratio)
        self.hp = Math.min(self.maxHp, self.hp + amount)
        engine.emitLog({
            type: 'heal',
            actionId: '_heal',
            actionName: '治疗',
            sourceId: self.id,
            targetId: self.id,
            amount,
        })
    },
    interrupt({ enemy, engine }: EffectCtx) {
        const INTERRUPT_DELAY = 1000
        engine.state.turn.modifyTime(enemy.id, INTERRUPT_DELAY)
        engine.emitLog({ type: 'interrupt', sourceId: '', targetId: enemy.id })
    },
    knockback({ eff, self, engine }: EffectCtx) {
        const { distance } = eff as Extract<EffectDef, { type: 'knockback' }>
        if (distance > 0) executeMove(self, engine, distance)
    },
    ciyuan_init({ self, engine }: EffectCtx) {
        const weapon = self.weaponDef ?? getWeapon(self.build.weapon)
        if (weapon.id === 'bare_hands') {
            self.weaponDef = { ...getWeapon('ciyuan_blade') }
            engine.emitLog({
                type: 'system',
                message: BattleLog.msg('次元刃', self.name, '凝炁为刃'),
                actorId: self.id,
            })
        } else {
            self.weaponDef = {
                ...weapon,
                tags: [...new Set([...weapon.tags, 'ignore_parry' as Tag, 'qi' as Tag])],
            }
            engine.emitLog({
                type: 'system',
                message: BattleLog.msg('次元刃', self.name, '附刃成功'),
                actorId: self.id,
            })
        }
        engine.state.pendingBuffs.set(`dimensional_blade::${self.id}`, { restoreValue: 1 })
    },
    fixed_damage({ eff, self, enemy, engine, action }: EffectCtx) {
        const { value } = eff as Extract<EffectDef, { type: 'fixed_damage' }>
        applyDamage(value, enemy, self, engine, action)
    },
    damage({ eff, self, enemy, engine, action }: EffectCtx) {
        const { scaling } = eff as Extract<EffectDef, { type: 'damage' }>
        const base = (eff as Extract<EffectDef, { type: 'damage' }>).base ?? 0
        const raw = calcBaseDamage(scaling, self.attrs.getAll(), base)
        if (raw > 0) {
            applyDamage(raw, enemy, self, engine, action)
        }
    },
    self_damage({ eff, self, engine }: EffectCtx) {
        const { ratio } = eff as Extract<EffectDef, { type: 'self_damage' }>
        const dmg = Math.round(self.maxHp * ratio)
        self.takeDamage(dmg)
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
    missing_hp_damage({ eff, self, enemy, engine, action }: EffectCtx) {
        const { ratio } = eff as Extract<EffectDef, { type: 'missing_hp_damage' }>
        const dmg = Math.round((enemy.maxHp - enemy.hp) * ratio)
        if (dmg > 0) {
            enemy.takeDamage(dmg)
            engine.emitLog({
                type: 'damage',
                actionId: action?.id ?? 'missing_hp_damage',
                actionName: action?.name ?? '崩劲',
                sourceId: self.id,
                targetId: enemy.id,
                base: dmg,
                final: dmg,
                blocked: 0,
                isCrit: false,
                isParried: false,
                tags: ['fixed_damage'],
            })
        }
    },
    status({ eff, self, enemy, engine, tMs }: EffectCtx) {
        handleStatusEffect({ eff: eff as Extract<EffectDef, { type: 'status' }>, self, enemy, engine, tMs })
    },

    // ── 自效果（无需命中判定） ──
    stat_multiply({ eff, self, engine, tMs }: EffectCtx) {
        const e = eff as Extract<EffectDef, { type: 'stat_multiply' }>
        const appId = genAppId(tMs)
        const layerKey = `stat_multiply::${self.id}::${appId}`
        const attr = e.stat as AttrName
        const old = self.attrs.get(attr)
        self.attrs.set(attr, old * e.multiplier)
        engine.emitLog({
            type: 'stat_change',
            targetId: self.id,
            attr: e.stat,
            delta: old * e.multiplier - old,
            label: getBuff('stat_multiply')?.name ?? '超越',
        })
        const attrVal = self.attrs.get(e.duration.attr)
        const buffDuration = calcBuffDuration(attrVal, e.duration.multiplier)
        engine.state.pendingBuffs.set(layerKey, {
            buffId: 'stat_multiply',
            restoreValue: old,
            mods: { [e.stat]: old },
        })
        scheduleBuffExpiry(engine, layerKey, buffDuration)
    },
    stat_buff({ eff, self, engine, tMs, action }: EffectCtx) {
        const e = eff as Extract<EffectDef, { type: 'stat_buff' }>
        const entries = Object.entries(e.attrs) as [AttrName, number][]
        for (const [attr, value] of entries) {
            self.attrs.modify(attr, value)
            engine.emitLog({
                type: 'stat_change',
                targetId: self.id,
                attr,
                delta: value,
                label: action?.name ?? getBuff('stat_buff')?.name ?? '内劲',
            })
        }
        // Duration support: 创建独立 buff 层用于定时恢复
        if (e.durationMs) {
            const appId = genAppId(tMs)
            const mods: Record<string, number> = {}
            for (const [attr, value] of entries) {
                mods[attr] = value
            }
            const layerKey = `stat_buff::${self.id}::${appId}`
            engine.state.pendingBuffs.set(layerKey, {
                buffId: 'stat_buff',
                restoreValue: 1,
                mods,
            })
            scheduleBuffExpiry(engine, layerKey, e.durationMs)
        }
    },
    restore_ap({ eff, self, engine }: EffectCtx) {
        const e = eff as Extract<EffectDef, { type: 'restore_ap' }>
        self.ap = Math.min(self.maxAp, self.ap + e.value)
        engine.emitLog({ type: 'system', message: BattleLog.msg('回气', self.name, `AP+${e.value}`), actorId: self.id })
    },
    summon_speed({ eff, self, engine }: EffectCtx) {
        const e = eff as Extract<EffectDef, { type: 'summon_speed' }>
        engine.speedUpSummons(self.id, e.value)
        engine.emitLog({
            type: 'system',
            message: BattleLog.msg('加速', self.name, `召唤物+${e.value}ms`),
            actorId: self.id,
        })
    },
    // permanent_burn({ eff, self, engine, tMs, log }: Ctx) {
    //     // 运行时由 engine 系统事件处理
    // },
    stat_transfer({ eff, self, enemy, engine, tMs }: EffectCtx) {
        const e = eff as Extract<EffectDef, { type: 'stat_transfer' }>
        const attr = e.stat as AttrName
        const appId = genAppId(tMs)
        const layerKey = `stat_transfer::${self.id}::${appId}`

        self.attrs.modify(attr, e.value)
        enemy.attrs.modify(attr, -e.value)
        engine.emitLog({ type: 'stat_change', targetId: enemy.id, attr: e.stat, delta: -e.value, label: '汲取' })
        if (e.stat === 'agility') {
            engine.state.turn.recalcInterval(self.id, self.attrs.get('agility'))
            engine.state.turn.recalcInterval(enemy.id, enemy.attrs.get('agility'))
        }
        engine.state.pendingBuffs.set(layerKey, {
            buffId: 'stat_transfer',
            restoreValue: e.value,
            targetId: enemy.id,
            mods: { [e.stat]: e.value },
        })
        scheduleBuffExpiry(engine, layerKey, e.duration)

        // AP 封顶
        if (e.stat === 'vitality') {
            self.capAp()
            enemy.capAp()
        }
    },
    crit_chance({ eff, self, engine, action }: EffectCtx) {
        const e = eff as Extract<EffectDef, { type: 'crit_chance' }>
        const label = action?.name || '暴击率'
        if (e.reset) {
            self.critChance = 0
        } else {
            self.critChance += e.value
        }
        engine.emitLog({
            type: 'system',
            message: e.reset
                ? BattleLog.msg(label, self.name, '蓄势消散')
                : BattleLog.msg(label, self.name, `蓄势+${Math.round(e.value * 100)}%`),
            actorId: self.id,
        })
    },
    crit_damage({ eff, self, engine, action }: EffectCtx) {
        const e = eff as Extract<EffectDef, { type: 'crit_damage' }>
        const label = action?.name || '暴击伤害'
        self.critDamageMod += e.value
        engine.emitLog({
            type: 'system',
            message: BattleLog.msg(label, self.name, `暴伤+${e.value}`),
            actorId: self.id,
        })
    },
    hit_chance({ eff, self }: EffectCtx) {
        const e = eff as Extract<EffectDef, { type: 'hit_chance' }>
        self.hitChanceMod += e.value
    },
    add_buff({ eff, self, engine }: EffectCtx) {
        const e = eff as Extract<EffectDef, { type: 'add_buff' }>
        const key = `${e.buffId}::${self.id}`
        const buff = getBuff(e.buffId)

        // 叠层处理
        const existing = engine.state.pendingBuffs.get(key)
        if (existing && buff?.stacking?.type === 'additive') {
            const max = buff.stacking.max ?? Infinity
            const newStacks = Math.min(max, existing.restoreValue + (e.stacks ?? 1))
            const delta = newStacks - existing.restoreValue
            existing.restoreValue = newStacks
            // 同步命中修正（刀势每层+0.05）
            if (e.buffId === 'momentum') self.hitChanceMod += delta * 0.05
            engine.emitLog({
                type: 'system',
                message: `${BattleLog.buffApply(buff?.name ?? e.buffId, self.name, buff?.description)} Lv.${newStacks}`,
                actorId: self.id,
            })
            engine.emit('on_buff', self, engine.state.characters.find((c) => c.id !== self.id)!, e.buffId)
            return
        }

        const mods: Record<string, number> = {}
        if (buff?.attrMods) {
            for (const [attr, value] of Object.entries(buff.attrMods)) {
                self.attrs.modify(attr as AttrName, value)
                mods[attr] = value
            }
        }
        engine.state.pendingBuffs.set(key, { restoreValue: e.stacks ?? 1, mods })
        // 缴械时自动记录当前武器
        if (e.buffId === 'disarmed') {
            const layer = engine.state.pendingBuffs.get(key)
            if (layer && !layer.extra?.originalWeapon) {
                layer.extra = { ...layer.extra, originalWeapon: self.weaponDef?.id ?? getWeapon(self.build.weapon).id }
            }
        }
        if (buff?.attrMods?.agility) engine.state.turn.recalcInterval(self.id, self.attrs.get('agility'))
        engine.emitLog({
            type: 'system',
            message: BattleLog.buffApply(buff?.name ?? e.buffId, self.name, buff?.description),
            actorId: self.id,
        })
        engine.emit('on_buff', self, engine.state.characters.find((c) => c.id !== self.id)!, e.buffId)
        // 调度过期事件
        if (buff?.expiry?.type === 'duration') {
            engine.state.turn.scheduleSystemEventAt(
                `buff_end_${key}`,
                engine.state.turn.currentTime + buff.expiry.ms,
                'buff_end',
            )
        }
        if (buff?.tickInterval) {
            engine.state.turn.scheduleSystemEventAt(
                `tick_buff_${key}`,
                engine.state.turn.currentTime + buff.tickInterval,
                'tick_buff',
            )
        }
    },
    remove_buff({ eff, self, engine }: EffectCtx) {
        const e = eff as Extract<EffectDef, { type: 'remove_buff' }>
        const key = `${e.buffId}::${self.id}`
        const layer = engine.state.pendingBuffs.get(key)
        if (!layer) return

        // 部分移除（减层数）
        if (e.stacks != null && layer.restoreValue > e.stacks) {
            let delta = -e.stacks
            const buff = getBuff(e.buffId)
            if (buff?.onBeforeModify) {
                delta = buff.onBeforeModify(delta, { character: self, engine })
            }
            if (delta < 0) {
                layer.restoreValue += delta // delta 为负
                if (e.buffId === 'momentum') self.hitChanceMod += delta * 0.05
                engine.emitLog({
                    type: 'system',
                    message: `${getBuff(e.buffId)?.name ?? e.buffId} ${self.name} ${Math.abs(delta)}层→${layer.restoreValue}层`,
                    actorId: self.id,
                })
            }
            return
        }

        // 全量移除
        const oldStacks = layer.restoreValue
        revertBuffMods(layer, self, engine)
        if (e.buffId === 'momentum') self.hitChanceMod -= oldStacks * 0.05
        engine.state.pendingBuffs.delete(key)
        const buffName = getBuff(e.buffId)?.name ?? e.buffId
        engine.emitLog({
            type: 'system',
            message:
                oldStacks > 1
                    ? `[${buffName}] ${BattleLog.name(self.name)} 状态消失（${oldStacks}层）`
                    : BattleLog.buffRemove(buffName, self.name),
            actorId: self.id,
        })
    },
    short_dash({ eff, self, engine }: EffectCtx) {
        const e = eff as Extract<EffectDef, { type: 'short_dash' }>
        const dist = engine.state.distance.current
        const maxDash = e.maxDistance ?? 2
        const targetDist = Math.max(0, dist - maxDash)
        const delta = dist - targetDist
        executeMove(self, engine, -delta)
    },
    dash({ eff, self, engine }: EffectCtx) {
        const e = eff as Extract<EffectDef, { type: 'dash' }>
        const minRange = e.minRange ?? 0
        const maxRange = e.maxRange ?? Infinity
        const dist = engine.state.distance.current
        if (dist < minRange || dist > maxRange) {
            engine.emitLog({ type: 'system', message: BattleLog.plain(self.name, '距离不合适'), actorId: self.id })
            return
        }
        const moveDist = dist - e.targetDist
        if (e.useAp) {
            const perAp = Math.max(0.5, self.attrs.get('agility') / 20)
            const apCost = Math.ceil(Math.abs(moveDist) / perAp)
            if (self.ap < apCost) {
                engine.emitLog({ type: 'system', message: `${self.name} AP不足`, actorId: self.id })
                return
            }
            self.spendAp(apCost)
            engine.state.distance.move(-moveDist)
            engine.emitLog({
                type: 'move',
                sourceId: self.id,
                delta: -moveDist,
                newDistance: engine.state.distance.current,
                apCost,
                apRemaining: self.ap,
            })
        } else {
            if (moveDist !== 0) executeMove(self, engine, -moveDist)
        }
    },
    disarm({ enemy, engine }: EffectCtx) {
        const oldWeapon = enemy.weaponDef ?? getWeapon(enemy.build.weapon)
        if (oldWeapon.id === 'bare_hands') return
        const key = `disarmed::${enemy.id}`
        if (engine.state.pendingBuffs.has(key)) return
        revertWeaponStatBuffs(oldWeapon, enemy, engine)
        // 清除武器专属 buff（如霸刀）
        clearWeaponBuffLayers(enemy.id, engine)
        enemy.weaponDef = { ...getWeapon('bare_hands') }
        // 清除次元刃状态
        engine.state.pendingBuffs.delete(`dimensional_blade::${enemy.id}`)
        // 缴械 buff（含原始武器信息，过期自动归还）
        engine.state.pendingBuffs.set(key, { restoreValue: 1, extra: { originalWeapon: oldWeapon.id } })
        const buffDef = getBuff('disarmed')
        if (buffDef?.expiry?.type === 'duration') {
            scheduleBuffExpiry(engine, key, buffDef.expiry.ms)
        }
        engine.emitLog({
            type: 'system',
            message: `[点腕] ${BattleLog.name(enemy.name)} 兵器脱手！`,
            actorId: enemy.id,
        })
    },
    switch_weapon({ eff, self, engine }: EffectCtx) {
        const e = eff as Extract<EffectDef, { type: 'switch_weapon' }>

        revertWeaponStatBuffs(self.weaponDef, self, engine)
        clearWeaponBuffLayers(self.id, engine)

        const weapon = getWeapon(e.weaponId)
        self.weaponDef = { ...weapon }

        // 应用新武器效果（御物除外）
        if (!weapon.tags.includes('imperial')) {
            for (const eff of weapon.effects ?? []) {
                if (eff.type === 'stat_buff') {
                    for (const [attr, value] of Object.entries(eff.attrs)) {
                        self.attrs.modify(attr as AttrName, value)
                        if (attr === 'agility') engine.state.turn.recalcInterval(self.id, self.attrs.get('agility'))
                    }
                }
            }
        }

        engine.emitLog({
            type: 'system',
            message: `[换武] ${self.name} 切换为 ${weapon.name}`,
            actorId: self.id,
        })
    },
}

// ── Status 子分发表 ──
const statusHandlers: Record<string, (ctx: EffectCtx) => void> = {
    bleed({ eff, self, enemy, engine }: EffectCtx) {
        const { stacks } = eff as Extract<EffectDef, { type: 'status' }>
        const key = `bleed::${enemy.id}`
        const existing = engine.state.pendingBuffs.get(key) as BuffLayer | undefined
        if (existing) {
            existing.restoreValue += stacks
        } else {
            engine.state.pendingBuffs.set(key, {
                restoreValue: stacks,
                extra: { bleedTriggerCount: 0, source: self.name, sourceId: self.id },
            })
        }
        const total = existing ? existing.restoreValue : stacks
        engine.emitLog({
            type: 'system',
            message: `[流血] ${BattleLog.name(enemy.name)} ${existing ? '叠层' : '获得'}→${total}层`,
            actorId: enemy.id,
        })
        engine.emit('on_debuff', self, enemy)
    },
    sand_blind({ enemy, engine }: EffectCtx) {
        const key = `sand_blind::${enemy.id}`
        if (engine.state.pendingBuffs.has(key)) return
        const buffDef = getBuff('sand_blind')
        const delta = buffDef?.attrMods?.insight ?? -4
        enemy.attrs.modify('insight', delta)
        engine.emitLog({ type: 'stat_change', targetId: enemy.id, attr: 'insight', delta, label: '迷眼' })
        const duration = calcDebuffDuration(2000, enemy.attrs.get('vitality'))
        engine.state.pendingBuffs.set(key, { restoreValue: 1, mods: { insight: delta } })
        engine.state.turn.scheduleSystemEventAt(`buff_end_${key}`, engine.state.turn.currentTime + duration, 'buff_end')
        engine.emitLog({
            type: 'system',
            message: `[迷眼] ${BattleLog.name(enemy.name)} 1层`,
            actorId: enemy.id,
        })
    },
    knockdown({ enemy, engine, tMs }: EffectCtx) {
        const buffDef = getBuff('knockdown')
        const agiDelta = buffDef?.attrMods?.agility ?? -4
        enemy.attrs.modify('agility', agiDelta)
        engine.emitLog({ type: 'stat_change', targetId: enemy.id, attr: 'agility', delta: agiDelta, label: '倒地' })
        engine.state.turn.recalcInterval(enemy.id, enemy.attrs.get('agility'))
        const appId = genAppId(tMs)
        const key = `knockdown::${enemy.id}::${appId}`
        const duration = calcDebuffDuration(2000, enemy.attrs.get('vitality'))
        engine.state.pendingBuffs.set(key, { restoreValue: 1, mods: { agility: agiDelta } })
        engine.state.turn.scheduleSystemEventAt(`buff_end_${key}`, engine.state.turn.currentTime + duration, 'buff_end')
        engine.emitLog({
            type: 'system',
            message: `[倒地] ${BattleLog.name(enemy.name)} 1层`,
            actorId: enemy.id,
        })
    },
    poison({ eff, self, enemy, engine, tMs }: EffectCtx) {
        const { stacks } = eff as Extract<EffectDef, { type: 'status' }>
        const key = `poison::${enemy.id}`
        const existing = engine.state.pendingBuffs.get(key) as BuffLayer | undefined
        if (existing) {
            existing.restoreValue += stacks
        } else {
            engine.state.pendingBuffs.set(key, {
                restoreValue: stacks,
                extra: { source: self.name, sourceId: self.id },
            })
        }
        const total = existing ? existing.restoreValue : stacks
        const dmg = total * 2
        enemy.takeDamage(dmg)
        engine.emitLog({
            type: 'system',
            message: BattleLog.msg('中毒', enemy.name, `${total}层×2=${dmg}伤害`),
            actorId: enemy.id,
        })
        engine.emit('on_poison', self, enemy)
        engine.emit('on_debuff', self, enemy)
        // 移除旧 tick 事件，防双重触发
        engine.state.turn.removeEvents(`tick_poison_${enemy.id}`)
        const interval = calcPoisonTickInterval(total)
        engine.state.turn.scheduleSystemEventAt(`tick_poison_${enemy.id}`, tMs + interval, 'tick_poison')
    },
    burn({ eff, self, enemy, engine, tMs }: EffectCtx) {
        const { stacks } = eff as Extract<EffectDef, { type: 'status' }>
        const key = `burn::${enemy.id}`
        const existing = engine.state.pendingBuffs.get(key) as BuffLayer | undefined
        if (existing) {
            existing.restoreValue += stacks
        } else {
            engine.state.pendingBuffs.set(key, {
                restoreValue: stacks,
                extra: { source: self.name, burnBaseDamage: 5, remainingTicks: stacks, sourceId: self.id },
            })
        }
        const total = existing ? existing.restoreValue : stacks
        engine.emitLog({
            type: 'system',
            message: `[灼烧] ${BattleLog.name(enemy.name)} ${existing ? '叠层' : '获得'}→${total}层`,
            actorId: enemy.id,
        })
        engine.state.turn.scheduleSystemEventAt(`tick_burn_${enemy.id}`, tMs + 1000, 'tick_burn')
    },
    paralyze({ eff, enemy, engine, tMs }: EffectCtx) {
        const e = eff as Extract<EffectDef, { type: 'status' }>
        const { stacks } = e
        const attrMods = getBuff('paralyze')!.attrMods!
        const duration = calcDebuffDuration(1800, enemy.attrs.get('vitality'))
        const appId = genAppId(tMs)
        const layerKey = `paralyze::${enemy.id}::${appId}`
        const mods: Record<string, number> = {}
        for (const [attr, rate] of Object.entries(attrMods)) {
            const delta = -Math.floor(Math.abs(rate) * stacks)
            enemy.attrs.modify(attr as AttrName, delta)
            mods[attr] = delta
            engine.emitLog({ type: 'stat_change', targetId: enemy.id, attr, delta, label: `麻痹(${stacks}层)` })
        }
        engine.state.turn.recalcInterval(enemy.id, enemy.attrs.get('agility'))

        engine.state.pendingBuffs.set(layerKey, {
            buffId: 'paralyze',
            restoreValue: stacks,
            mods,
        })
        engine.state.turn.scheduleSystemEventAt(
            `buff_end_${layerKey}`,
            engine.state.turn.currentTime + duration,
            'buff_end',
        )
    },
    frost({ eff, enemy, engine, tMs }: EffectCtx) {
        const e = eff as Extract<EffectDef, { type: 'status' }>
        const { stacks } = e
        const buffDef = getBuff('frost')
        const agiPerStack = buffDef?.attrMods?.agility ?? -0.2
        const delta = -Math.round(stacks * Math.abs(agiPerStack) * 10) / 10
        if (delta === 0) return
        const duration = calcDebuffDuration(3000, enemy.attrs.get('vitality'))
        const appId = genAppId(tMs)
        const layerKey = `frost::${enemy.id}::${appId}`
        enemy.attrs.modify('agility', delta)
        engine.emitLog({ type: 'stat_change', targetId: enemy.id, attr: 'agility', delta, label: '霜冻' })
        engine.state.turn.recalcInterval(enemy.id, enemy.attrs.get('agility'))
        engine.state.pendingBuffs.set(layerKey, {
            restoreValue: stacks,
            mods: { agility: delta },
        })
        engine.state.turn.scheduleSystemEventAt(
            `buff_end_${layerKey}`,
            engine.state.turn.currentTime + duration,
            'buff_end',
        )
    },
    stun({ eff, enemy, engine, tMs }: EffectCtx) {
        const { stacks } = eff as Extract<EffectDef, { type: 'status' }>
        const STUN_DURATION = calcDebuffDuration(2000, enemy.attrs.get('vitality'))
        const STUN_RESET_WINDOW = 5000

        // 连续递减追踪
        const trackKey = `stun_track::${enemy.id}`
        const lastData = engine.state.pendingBuffs.get(trackKey)
        const now = engine.state.turn.currentTime
        let consecutive = 0
        if (lastData && now - lastData.restoreValue < STUN_RESET_WINDOW) {
            consecutive = (lastData.extra?.consecutive as number) ?? 0
        }
        consecutive++
        engine.state.pendingBuffs.set(trackKey, { restoreValue: now, extra: { consecutive } })
        engine.state.turn.scheduleSystemEventAt(`stun_reset_${enemy.id}`, now + STUN_RESET_WINDOW, 'stun_reset')

        // 数值递减
        const ratio = calcStunAttrRatio(consecutive)
        const agility = enemy.attrs.get('agility')
        const insight = enemy.attrs.get('insight')
        const agiDelta = calcStunAttrDelta(agility, ratio)
        const insDelta = calcStunAttrDelta(insight, ratio)
        if (agiDelta !== 0) {
            enemy.attrs.modify('agility', agiDelta)
            engine.emitLog({ type: 'stat_change', targetId: enemy.id, attr: 'agility', delta: agiDelta, label: '眩晕' })
        }
        if (insDelta !== 0) {
            enemy.attrs.modify('insight', insDelta)
            engine.emitLog({ type: 'stat_change', targetId: enemy.id, attr: 'insight', delta: insDelta, label: '眩晕' })
        }
        engine.state.turn.recalcInterval(enemy.id, enemy.attrs.get('agility'))

        const appId = genAppId(tMs)
        const layerKey = `stun::${enemy.id}::${appId}`
        engine.state.pendingBuffs.set(layerKey, {
            buffId: 'stun',
            restoreValue: stacks,
            mods: { agility: agiDelta, insight: insDelta },
        })
        engine.state.turn.scheduleSystemEventAt(
            `buff_end_${layerKey}`,
            engine.state.turn.currentTime + STUN_DURATION,
            'buff_end',
        )
        engine.emitLog({
            type: 'system',
            message: `[眩晕] ${BattleLog.name(enemy.name)} ${stacks}层`,
            actorId: enemy.id,
        })
    },
}

function handleStatusEffect(ctx: EffectCtx & { eff: EffectDef & { type: 'status' } }): void {
    const { eff, self, enemy, engine, tMs } = ctx
    const { success } = calcRoll(eff.chance)
    if (!success) return

    const st = eff.status
    // ── 免疫检查（冰心诀：仅灼烧/冰霜/麻痹） ──
    if (
        engine.state.pendingBuffs.has(`elemental_immunity::${enemy.id}`) &&
        (st === 'burn' || st === 'frost' || st === 'paralyze')
    ) {
        engine.emitLog({ type: 'system', message: `[冰心] ${enemy.name} 免疫 ${st}`, actorId: enemy.id })
        return
    }
    // const key = `${st}::${enemy.id}`
    // const existing = engine.state.pendingBuffs.get(key) as BuffLayer | undefined

    const handler = statusHandlers[eff.status]
    if (handler) {
        handler({ eff, self, enemy, engine, tMs })
    } else {
        console.warn(`[effect-processor] 未注册的 status 类型: ${eff.status}`)
    }
}

/** 处理一个效果（统一入口） */
export function processActionEffect(
    eff: EffectDef,
    self: Character,
    enemy: Character,
    engine: BattleEngine,
    tMs: number,
    action?: ActionDefinition,
): void {
    const handler = effectHandlers[eff.type]
    if (handler) handler({ eff, self, enemy, engine, tMs, action })
}

/** 处理 status tick（毒/灼烧），从 pendingBuffs 读取层数，返回 damage 和下次间隔 */
export function processStatusTick(
    charId: string,
    char: Character,
    engine: BattleEngine,
    _tMs: number,
    type: 'poison' | 'burn',
): { damage: number; nextInterval: number } {
    const key = `${type}::${charId}`
    const entry = engine.state.pendingBuffs.get(key)
    if (!entry) return { damage: 0, nextInterval: 0 }

    if (type === 'poison') {
        const stacks = entry.restoreValue
        const dmg = stacks * 2
        char.takeDamage(dmg)
        const nextInterval = calcPoisonTickInterval(stacks)
        const buffName = getBuff('poison')?.name ?? '中毒'
        engine.emitLog({
            type: 'damage_over_time',
            actionId: 'poison',
            actionName: `${buffName}(${stacks}层)`,
            sourceId: (entry.extra?.sourceId as string) ?? '?',
            targetId: char.id,
            status: buffName,
            amount: dmg,
        })
        if (dmg > 0) {
            engine.emit('on_took_damage', char, char)
        }
        return { damage: dmg, nextInterval }
    }

    if (type === 'burn') {
        const stacks = entry.restoreValue
        const burnBaseDamage = (entry.extra?.burnBaseDamage as number) ?? 0
        const remainingTicks = (entry.extra?.remainingTicks as number) ?? 0
        if (!burnBaseDamage || !remainingTicks) return { damage: 0, nextInterval: 0 }
        const dmg = Math.round(burnBaseDamage * (stacks / (stacks + remainingTicks)))
        entry.extra = { ...entry.extra, remainingTicks: remainingTicks - 1 }
        entry.restoreValue = Math.max(0, stacks - 1)
        char.takeDamage(dmg)
        const buffName = getBuff('burn')?.name ?? '灼烧'
        engine.emitLog({
            type: 'damage_over_time',
            actionId: 'burn',
            actionName: `${buffName}(${stacks}层)`,
            sourceId: (entry.extra?.sourceId as string) ?? '?',
            targetId: char.id,
            status: buffName,
            amount: dmg,
        })
        if (dmg > 0) {
            engine.emit('on_took_damage', char, char)
        }
        return { damage: dmg, nextInterval: remainingTicks - 1 > 0 ? 1000 : 0 }
    }

    return { damage: 0, nextInterval: 0 }
}

// ── Combat rolls ──

/** 命中判定，返回 false 则攻击终止 */
export function processHitCheck(
    action: ActionDefinition,
    r: ActionResult,
    self: Character,
    enemy: Character,
    engine: BattleEngine,
): boolean {
    engine.emit('on_attack', self, enemy)
    const rangeDodgeMod =
        engine.state.pendingBuffs.has(`ranged_dodge::${enemy.id}`) && engine.state.distance.current >= 5 ? 0.15 : 0
    let hc =
        action.chance ??
        calcHitChance({
            attackerDexterity: self.attrs.get('dexterity'),
            attackerInsight: self.attrs.get('insight'),
            defenderAgility: enemy.attrs.get('agility'),
            defenderInsight: enemy.attrs.get('insight'),
            defenderDodgeMod: enemy.dodgeMod + rangeDodgeMod,
        })
    // 通用命中修正（hit_chance 效果 + 刀势每层+0.05）
    if (self.hitChanceMod) {
        hc = Math.min(0.95, hc + self.hitChanceMod)
    }
    // 圆 buff：下次攻击距离≤4时命中+0.5，消耗
    const circleKey = `circle::${self.id}`
    if (engine.state.pendingBuffs.has(circleKey) && engine.state.distance.current <= 4) {
        hc = Math.min(0.95, hc + 0.5)
        engine.state.pendingBuffs.delete(circleKey)
    }
    // buff 命中率钩子
    for (const [key, layer] of engine.state.pendingBuffs) {
        const parts = key.split('::')
        if (parts.length < 2 || parts[1] !== self.id) continue
        const def = getBuff(parts[0])
        if (!def?.onHitChance) continue
        const hcMod = def.onHitChance({
            final: 0,
            raw: 0,
            attacker: self,
            target: enemy,
            action,
            engine,
            buffOwnerId: parts[1],
            layer,
        })
        hc = hc + hcMod
    }
    const hitResult = calcRoll(hc)
    r.hit = hitResult.success
    engine.emitLog({
        type: 'check_hit',
        sourceId: self.id,
        targetId: enemy.id,
        hitChance: hc,
        roll: hitResult.roll,
        result: hitResult.success,
    })
    if (!r.hit) {
        engine.emitLog({ type: 'dodged', sourceId: self.id, targetId: enemy.id })
        engine.emit('on_dodged', self, enemy)
        engine.emit('on_dodge', enemy, self)
        return false
    }

    return true
}

// ── Bleed ──

/** 对目标执行流血伤害 */
export function processBleedDamage(owner: Character, _tMs: number, engine: BattleEngine): void {
    const key = `bleed::${owner.id}`
    const entry = engine.state.pendingBuffs.get(key)
    if (!entry) return
    const stacks = entry.restoreValue
    const dmg = triggerBleed(stacks)
    if (dmg > 0) {
        owner.takeDamage(dmg)
        const bt = ((entry.extra?.bleedTriggerCount as number) ?? 0) + 1
        entry.extra = { ...entry.extra, bleedTriggerCount: bt }
        if (bt >= 5) {
            entry.extra = { ...entry.extra, bleedTriggerCount: 0 }
            entry.restoreValue = Math.max(0, stacks - 1)
        }
        const buffName = getBuff('bleed')?.name ?? '流血'
        engine.emitLog({
            type: 'damage_over_time',
            actionId: 'bleed',
            actionName: `${buffName}(${stacks}层)`,
            sourceId: (entry.extra?.sourceId as string) ?? '?',
            targetId: owner.id,
            status: buffName,
            amount: dmg,
        })
    }
}

// ── 通用伤害修正 ──

/** 遍历双方 buff 的 onDamage 钩子，自动修正伤害 */
function applyDamageModifiers(
    final: number,
    target: Character,
    attacker: Character,
    engine: BattleEngine,
    raw: number,
    actionDef?: ActionDefinition,
): number {
    for (const [key, layer] of engine.state.pendingBuffs) {
        const parts = key.split('::')
        if (parts.length < 2) continue
        if (parts[1] !== target.id && parts[1] !== attacker.id) continue
        const def = getBuff(parts[0])
        const act = actionDef ?? getAction('')
        if (!act || !def?.onDamage) continue
        final = def.onDamage({ final, raw, target, attacker, engine, layer, buffOwnerId: parts[1], action: act })
    }
    return final
}

// ── Buff end ──

/** buff 到期恢复 */
export function processBuffEnd(buffKey: string, engine: BattleEngine): void {
    const layer = engine.state.pendingBuffs.get(buffKey)
    if (!layer) return
    const parts = buffKey.split('::')
    if (parts.length < 2) return

    const buffId = parts[0]
    const charId = parts[1]

    // 2-part keys: 直接删
    if (parts.length === 2) {
        const char = engine.getCharacter(charId)
        if (char) revertBuffMods(layer, char, engine)
        engine.state.pendingBuffs.delete(buffKey)
        // 过期自动归还武器
        if (buffId === 'disarmed' && char?.isAlive()) {
            const originalWeapon = layer.extra?.originalWeapon as string | undefined
            if (originalWeapon) {
                engine.emitLog({
                    type: 'system',
                    message: `[缴械] ${BattleLog.name(char.name)} 重握兵器！`,
                    actorId: char.id,
                })
                processActionEffect(
                    { type: 'switch_weapon', weaponId: originalWeapon },
                    char,
                    char,
                    engine,
                    engine.state.turn.currentTime,
                )
            }
        }

        return
    }

    const tag = getBuff(buffId)?.name ?? buffId

    // 通用：反转属性变化
    const char = engine.getCharacter(charId)
    if (char) revertBuffMods(layer, char, engine)

    // stat_transfer：正向恢复目标
    if (buffId === 'stat_transfer' && layer.targetId) {
        const target = engine.getCharacter(layer.targetId)
        if (target && layer.mods) {
            for (const [attr, delta] of Object.entries(layer.mods)) {
                target.attrs.modify(attr as AttrName, delta)
                if (attr === 'agility') engine.state.turn.recalcInterval(target.id, target.attrs.get('agility'))
            }
        }
    }

    if (char && layer.mods) {
        for (const [attr, delta] of Object.entries(layer.mods)) {
            const expireLabel = ['frost', 'paralyze', 'knockdown', 'sand_blind', 'stun'].includes(buffId)
                ? `${tag}消失`
                : tag
            engine.emitLog({
                type: 'stat_change',
                targetId: char.id,
                attr,
                delta: -(delta as number),
                label: expireLabel,
            })
        }
    }

    engine.state.pendingBuffs.delete(buffKey)
}
