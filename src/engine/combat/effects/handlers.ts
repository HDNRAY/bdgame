import type { EffectDef } from '../../entities/action'
import type { AttrName } from '../../entities/attributes'
import type { StatusType } from '../../entities/status'
import { calcBaseDamage, calcHealAmount, calcBuffDuration, calcRoll } from '../../calc/damage'
import { getWeapon } from '../../data/weapons'
import { getBuff } from '../../data/buffs'
import { getPassive } from '../../data/passives'
import { getAction } from '../../data/actions'
import { genAppId } from '../../util/buff-utils'
import type { Tag } from '../../entities/tag'
import { scheduleBuffExpiry, revertBuffMods, clearWeaponBuffLayers, executeMove, revertWeaponStatBuffs } from '../utils'
import { pickBestPassives } from '../utils/tag-match'
import { BattleLog } from '../battle-log'
import type { EffectCtx } from './types'
import { applyDamage, applyBonusDamage } from './damage'
import { processActionEffect } from './action'
import { handleStatusEffect } from './status'
import { applyAttrMods, reduceBleedOnHeal } from '../utils/buff-layer'

export const effectHandlers: Record<string, (ctx: EffectCtx) => void> = {
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
        self.heal(amount)
        reduceBleedOnHeal(engine, self.id, amount)
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
            // 走 switch_weapon 流程以确保 passiveTriggers / on_equip 等正确
            processActionEffect(
                { type: 'switch_weapon', weaponId: 'ciyuan_blade' },
                self,
                self,
                engine,
                engine.state.turn.currentTime,
            )
            engine.emitLog({
                type: 'system',
                message: BattleLog.msg('灵剑', self.name, '凝炁为刃'),
                actorId: self.id,
            })
        } else {
            self.weaponDef = {
                ...weapon,
                tags: [...new Set([...weapon.tags, 'qi' as Tag])],
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
            applyBonusDamage(
                dmg,
                enemy,
                self,
                engine,
                action,
                action?.name ?? '崩劲',
                action?.id ?? 'missing_hp_damage',
            )
        }
    },
    self_missing_hp_damage({ eff, self, enemy, engine, action }: EffectCtx) {
        const { ratio } = eff as Extract<EffectDef, { type: 'self_missing_hp_damage' }>
        const dmg = Math.round((self.maxHp - self.hp) * ratio)
        if (dmg > 0) {
            applyBonusDamage(
                dmg,
                enemy,
                self,
                engine,
                action,
                action?.name ?? '黯然',
                action?.id ?? 'self_missing_hp_damage',
            )
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
        const label = action?.name ?? getBuff('stat_buff')?.name ?? '内劲'
        const mods = applyAttrMods(self, engine, e.attrs as Record<string, number>, label)
        if (e.durationMs) {
            const appId = genAppId(tMs)
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
                : BattleLog.msg(label, self.name, `蓄势暴击率+${Math.round(e.value * 100)}%`),
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
    fumble_chance({ eff, enemy, engine }: EffectCtx) {
        const e = eff as Extract<EffectDef, { type: 'fumble_chance' }>
        const key = `fumble_chance::${enemy.id}`
        const buff = getBuff('fumble_chance')
        const existing = engine.state.pendingBuffs.get(key)
        const stacks = e.value ?? 1
        if (existing && buff?.stacking?.type === 'additive') {
            existing.restoreValue += stacks
        } else {
            engine.state.pendingBuffs.set(key, { restoreValue: stacks })
        }
        // 5s 后消失
        scheduleBuffExpiry(engine, key, 5000)
        const total = engine.state.pendingBuffs.get(key)?.restoreValue ?? 0
        engine.emitLog({
            type: 'system',
            message: `[失心] ${enemy.name} 晃神率+${(total * 5).toFixed(0)}%`,
            actorId: enemy.id,
        })
    },
    add_buff({ eff, self, engine }: EffectCtx) {
        const e = eff as Extract<EffectDef, { type: 'add_buff' }>
        const key = `${e.buffId}::${self.id}`
        const buff = getBuff(e.buffId)

        const existing = engine.state.pendingBuffs.get(key)
        if (existing && buff?.stacking?.type === 'additive') {
            const max = buff.stacking.max ?? Infinity
            const newStacks = Math.min(max, existing.restoreValue + (e.stacks ?? 1))
            const delta = newStacks - existing.restoreValue
            if (delta <= 0) return // 已达上限，不显示 log
            existing.restoreValue = newStacks
            if (e.buffId === 'momentum') self.hitChanceMod += delta * 0.05
            // 按层数累加 attrMods
            if (buff?.attrMods && delta > 0) {
                const scaledMods: Record<string, number> = {}
                for (const [attr, val] of Object.entries(buff.attrMods)) {
                    scaledMods[attr] = (val as number) * delta
                }
                const newMods = applyAttrMods(self, engine, scaledMods, buff.name)
                if (!existing.mods) existing.mods = {}
                for (const [attr, val] of Object.entries(newMods)) {
                    existing.mods[attr] = (existing.mods[attr] ?? 0) + (val as number)
                }
            }
            engine.emitLog({
                type: 'system',
                message: `${BattleLog.buffApply(buff?.name ?? e.buffId, self.name, buff?.description)} Lv.${newStacks}`,
                actorId: self.id,
            })
            engine.emit('on_buff', self, engine.state.characters.find((c) => c.id !== self.id)!, e.buffId)
            return
        }

        const mods = buff?.attrMods ? applyAttrMods(self, engine, buff.attrMods, buff.name) : {}
        engine.state.pendingBuffs.set(key, { restoreValue: e.stacks ?? 1, mods })
        if (e.buffId === 'disarmed') {
            // 清理旧 buff_end 事件，防止残留事件误触
            engine.state.turn.removeEvents('buff_end_' + key)
            const layer = engine.state.pendingBuffs.get(key)
            if (layer && !layer.extra?.originalWeapon) {
                layer.extra = {
                    ...layer.extra,
                    originalWeapon: self.weaponDef?.id ?? getWeapon(self.build.weapon).id,
                    dropPosition: engine.state.position.get(self.id),
                }
            }
        }
        engine.emitLog({
            type: 'system',
            message: BattleLog.buffApply(buff?.name ?? e.buffId, self.name, buff?.description),
            actorId: self.id,
        })
        engine.emit('on_buff', self, engine.state.characters.find((c) => c.id !== self.id)!, e.buffId)
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

        if (e.stacks != null && layer.restoreValue > e.stacks) {
            let delta = -e.stacks
            const buff = getBuff(e.buffId)
            if (buff?.onBeforeModify) {
                delta = buff.onBeforeModify(delta, { character: self, engine })
            }
            if (delta < 0) {
                layer.restoreValue += delta
                if (e.buffId === 'momentum') self.hitChanceMod += delta * 0.05
                // 部分移除时按比例回退 attrMods
                if (buff?.attrMods && layer.mods) {
                    const ratio = Math.abs(delta) / (layer.restoreValue - delta)
                    for (const [attr, val] of Object.entries(buff.attrMods)) {
                        const revertVal = Math.round((val as number) * delta * ratio)
                        if (revertVal !== 0) {
                            self.attrs.modify(attr as AttrName, revertVal)
                            layer.mods[attr] = (layer.mods[attr] ?? 0) + revertVal
                            if (attr === 'agility') engine.state.turn.recalcInterval(self.id, self.attrs.get('agility'))
                        }
                    }
                }
                if (e.buffId !== 'disarmed') {
                    engine.emitLog({
                        type: 'system',
                        message: `${getBuff(e.buffId)?.name ?? e.buffId} ${self.name} ${Math.abs(delta)}层→${layer.restoreValue}层`,
                        actorId: self.id,
                    })
                }
            }
            return
        }

        const oldStacks = layer.restoreValue
        revertBuffMods(layer, self, engine)
        if (e.buffId === 'momentum') self.hitChanceMod -= oldStacks * 0.05
        engine.state.pendingBuffs.delete(key)
        engine.state.turn.removeEvents('buff_end_' + key)
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
    short_dash({ eff, self, engine }: EffectCtx) {
        const e = eff as Extract<EffectDef, { type: 'short_dash' }>
        const opponent = engine.getOpponent(self.id)!
        const dist = engine.state.position.distance(self.id, opponent.id)
        // 如果已在武器有效射程内，或比最小射程还近（太近了冲也没用），不冲刺
        const weapon = self.weaponDef ?? getWeapon(self.build.weapon)
        if (weapon.range && dist <= weapon.range[1]) return
        const maxDash = e.maxDistance ?? 2
        const targetDist = Math.max(0, dist - maxDash)
        const delta = dist - targetDist
        executeMove(self, engine, -delta)
    },
    dash({ eff, self, engine }: EffectCtx) {
        const e = eff as Extract<EffectDef, { type: 'dash' }>
        const opponent = engine.getOpponent(self.id)!
        const minRange = e.minRange ?? 0
        const maxRange = e.maxRange ?? Infinity
        const dist = engine.state.position.distance(self.id, opponent.id)
        if (dist < minRange || dist > maxRange) {
            engine.emitLog({ type: 'system', message: BattleLog.plain(self.name, '距离不合适'), actorId: self.id })
            return
        }
        const moveDist = dist - e.targetDist
        if (e.useAp) {
            const perAp = Math.max(0.5, self.attrs.get('agility') / 20)
            const apCost = Math.ceil(Math.abs(moveDist) / perAp)
            if (self.ap < apCost) {
                // engine.emitLog({ type: 'system', message: `${self.name} AP不足`, actorId: self.id })
                return
            }
            self.spendAp(apCost)
            const p = engine.state.position
            const actualDelta = p.moveToward(self.id, opponent.id, -moveDist)
            engine.emitLog({
                type: 'move',
                sourceId: self.id,
                delta: actualDelta,
                newDistance: p.distance(self.id, opponent.id),
                apCost,
                apRemaining: self.ap,
            })
        } else {
            if (moveDist !== 0) executeMove(self, engine, -moveDist)
        }
    },
    disarm({ eff, enemy, engine }: EffectCtx) {
        const e = eff as Extract<EffectDef, { type: 'disarm' }>
        if (e.chance !== undefined) {
            const { success } = calcRoll(e.chance)
            if (!success) return
        }
        const oldWeapon = enemy.weaponDef ?? getWeapon(enemy.build.weapon)
        if (oldWeapon.id === 'bare_hands') return
        // 御物武器免疫缴械
        if (oldWeapon.tags.includes('imperial')) return
        const key = `disarmed::${enemy.id}`
        if (engine.state.pendingBuffs.has(key)) return

        // 脱手清除刀势
        const momentumKey = `momentum::${enemy.id}`
        const momentumLayer = engine.state.pendingBuffs.get(momentumKey)
        if (momentumLayer) {
            const stacks = momentumLayer.restoreValue
            enemy.hitChanceMod -= stacks * 0.05
            engine.state.pendingBuffs.delete(momentumKey)
            engine.state.turn.removeEvents('buff_end_' + momentumKey)
            engine.emitLog({
                type: 'system',
                message: `[刀势] ${BattleLog.name(enemy.name)} 状态消失（${stacks}层）`,
                actorId: enemy.id,
            })
        }

        // 记录掉落位置
        const dropPosition = engine.state.position.get(enemy.id)
        revertWeaponStatBuffs(oldWeapon, enemy, engine)
        clearWeaponBuffLayers(enemy.id, engine)
        enemy.weaponDef = { ...getWeapon('bare_hands') }
        engine.state.pendingBuffs.delete(`dimensional_blade::${enemy.id}`)
        engine.state.pendingBuffs.set(key, { restoreValue: 1, extra: { originalWeapon: oldWeapon.id, dropPosition } })
        engine.emitLog({
            type: 'system',
            message: `[点腕] ${BattleLog.name(enemy.name)} 兵器脱手！`,
            actorId: enemy.id,
        })
    },
    switch_weapon({ eff, self, engine }: EffectCtx) {
        const e = eff as Extract<EffectDef, { type: 'switch_weapon' }>

        // const oldWeaponName = (self.weaponDef ?? getWeapon(self.build.weapon)).name
        const oldWeapon = self.weaponDef ?? getWeapon(self.build.weapon)
        revertWeaponStatBuffs(oldWeapon, self, engine)
        clearWeaponBuffLayers(self.id, engine)
        // 移除旧武器的 passive triggers
        for (const t of oldWeapon.triggers ?? []) {
            const idx = self.passiveTriggers.indexOf(t)
            if (idx !== -1) self.passiveTriggers.splice(idx, 1)
        }

        const weapon = getWeapon(e.weaponId)
        self.weaponDef = { ...weapon }
        // 加入新武器的 passive triggers
        for (const t of weapon.triggers ?? []) {
            self.passiveTriggers.push(t)
        }

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

        // engine.emitLog({
        //     type: 'system',
        //     message: `[换武] ${self.name} ${oldWeaponName} → ${weapon.name}`,
        //     actorId: self.id,
        // })
        // 触发武器的 on_equip（新武器的装备效果，如霸刀buff）
        engine.emit('on_equip', self, self)
    },
    retrieve_weapon({ self, engine }: EffectCtx) {
        const key = `disarmed::${self.id}`
        const layer = engine.state.pendingBuffs.get(key)
        if (!layer?.extra?.originalWeapon) return
        // 1. 切回原武器 → 触发 on_equip → 自动加武器 buff
        processActionEffect(
            { type: 'switch_weapon', weaponId: layer.extra.originalWeapon as string },
            self,
            self,
            engine,
            engine.state.turn.currentTime,
        )
        // 2. 移除缴械
        const removeEff: EffectDef = { type: 'remove_buff', buffId: 'disarmed' }
        processActionEffect(removeEff, self, self, engine, engine.state.turn.currentTime)
    },
    copy_best_passive({ self, engine }: EffectCtx) {
        const enemy = engine.getOpponent(self.id)
        if (!enemy) return
        // 清空缠
        self.chan = 0
        engine.checkChanOverflow(self.id)
        // 复制 2 个最匹配的功法
        const copiedIds = pickBestPassives(self, enemy, 2)
        for (const copiedId of copiedIds) {
            const def = getPassive(copiedId)
            if (!def) continue
            self.passiveDefs.push(def)
            self.applyPassive(def)
            // 只触发该被动的 battle_start 效果，不触发全局事件（避免重复 buff）
            for (const slot of def.triggers ?? []) {
                if (slot.condition.type !== 'battle_start') continue
                if (slot.effects) {
                    for (const eff of slot.effects) {
                        processActionEffect(eff, self, enemy, engine, engine.state.turn.currentTime)
                    }
                }
                if (slot.actionId) {
                    const action = getAction(slot.actionId)
                    if (action && action.apCost <= 2) {
                        for (const eff of action.effects ?? []) {
                            processActionEffect(eff, self, enemy, engine, engine.state.turn.currentTime, action)
                        }
                    }
                }
            }
        }
        if (copiedIds.length > 0) {
            const names = copiedIds.map((id) => getPassive(id)?.name ?? id).join('、')
            engine.emitLog({
                type: 'system',
                message: `[小无相功] ${self.name} 窥破破绽，复制了「${names}」`,
                actorId: self.id,
            })
        }
    },
}
