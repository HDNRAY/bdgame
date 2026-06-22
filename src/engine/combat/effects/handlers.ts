import type { EffectDef } from '../../entities/action'
import { ATTR_CN, type AttrName } from '../../entities/attributes'
import { calcBaseDamage, calcHealAmount, calcBuffDuration, calcRoll, calcDebuffDuration } from '../../calc/damage'
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

import { applyAttrMods, reduceBleedOnHeal } from '../utils/buff-layer'

/** 检查目标是否有渊渟岳峙免疫（不可击退/打断/缴械/击倒/失衡） */
function hasYuanYing(target: { id: string }, engine: { state: { pendingBuffs: Map<string, unknown> } }): boolean {
    return engine.state.pendingBuffs.has(`yuanting_yuezhi::${target.id}`)
}
import { tickEngine } from '../tick-engine'

export const effectHandlers: Record<string, (ctx: EffectCtx) => void> = {
    cleanse({ eff, self, engine }: EffectCtx) {
        const { buffIds } = eff as Extract<EffectDef, { type: 'cleanse' }>
        const targets = buffIds ?? ['paralyze', 'poison']
        for (const [k] of engine.state.pendingBuffs) {
            const [prefix] = k.split('::')
            if (targets.includes(prefix)) {
                engine.state.pendingBuffs.delete(k)
            }
        }
        engine.emitLog({ type: 'cleanse', sourceId: self.id, targetId: self.id, buffIds: targets })
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
        if (hasYuanYing(enemy, engine)) {
            engine.emitLog({ type: 'system', message: `[渊渟岳峙] ${enemy.name} 免疫打断`, actorId: enemy.id })
            return
        }
        const INTERRUPT_DELAY = 1000
        engine.state.turn.modifyTime(enemy.id, INTERRUPT_DELAY)
        engine.emitLog({ type: 'interrupt', sourceId: '', targetId: enemy.id })
    },
    knockback({ eff, self, engine }: EffectCtx) {
        if (hasYuanYing(self, engine)) {
            engine.emitLog({ type: 'system', message: `[渊渟岳峙] ${self.name} 免疫击退`, actorId: self.id })
            return
        }
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
            const newMax = Math.max(3, weapon.range[1])
            self.weaponDef = {
                ...weapon,
                tags: [...new Set([...weapon.tags, 'qi' as Tag])],
                range: [weapon.range[0], newMax] as [number, number],
            }
            engine.emitLog({
                type: 'system',
                message: BattleLog.msg('次元刃', self.name, `附刃成功，射程扩展至${newMax}`),
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
            applyBonusDamage(dmg, enemy, self, engine, action, '崩劲', 'missing_hp_damage')
        }
    },
    self_missing_hp_damage({ eff, self, enemy, engine, action }: EffectCtx) {
        const { ratio } = eff as Extract<EffectDef, { type: 'self_missing_hp_damage' }>
        const dmg = Math.round((self.maxHp - self.hp) * ratio)
        if (dmg > 0) {
            applyBonusDamage(dmg, enemy, self, engine, action, '黯然', 'self_missing_hp_damage')
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
            engine.state.turn.recalcInterval(self.id, self.attrs.get('agility'), self.getHaste())
            engine.state.turn.recalcInterval(enemy.id, enemy.attrs.get('agility'), enemy.getHaste())
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
    add_debuff({ eff, self, enemy, engine, tMs }: EffectCtx) {
        const e = eff as Extract<EffectDef, { type: 'add_debuff' }>
        const { success } = calcRoll(e.chance)
        if (!success) return

        const buff = getBuff(e.buffId)
        if (!buff) return

        const st = e.buffId
        // 免疫检查
        if (
            engine.state.pendingBuffs.has(`elemental_immunity::${enemy.id}`) &&
            (st === 'burn' || st === 'frost' || st === 'paralyze')
        ) {
            engine.emitLog({ type: 'system', message: `[冰心] ${enemy.name} 免疫 ${st}`, actorId: enemy.id })
            return
        }
        if (engine.state.pendingBuffs.has(`dark_room_sense::${enemy.id}`) && st === 'sand_blind') {
            engine.emitLog({ type: 'system', message: `[暗室抓雀功] ${enemy.name} 免疫迷眼`, actorId: enemy.id })
            return
        }
        if (engine.state.pendingBuffs.has(`paralyze_immunity::${enemy.id}`) && st === 'paralyze') {
            engine.emitLog({ type: 'system', message: `[雷体] ${enemy.name} 免疫麻痹`, actorId: enemy.id })
            return
        }
        // 渊渟岳峙免疫
        if (hasYuanYing(enemy, engine) && (st === 'stagger' || st === 'knockdown' || st === 'fumble_chance')) {
            engine.emitLog({ type: 'system', message: `[渊渟岳峙] ${enemy.name} 免疫${buff.name}`, actorId: enemy.id })
            return
        }

        const keyBase = `${buff.id}::${enemy.id}`
        const isIndependent = buff?.stacking?.type === 'independent'
        // independent 叠层使用 appId 后缀，每次应用独立生效
        const key = isIndependent ? `${keyBase}::${genAppId(tMs)}` : keyBase
        const existing = !isIndependent ? engine.state.pendingBuffs.get(key) : undefined
        const stacks = e.stacks ?? 1

        /** 获取 debuff 专属 extra 数据 */
        function makeExtra(): Record<string, number | string | boolean> | undefined {
            if (st === 'burn')
                return { source: self.name, burnBaseDamage: 5, remainingTicks: stacks, sourceId: self.id }
            if (st === 'bleed') return { bleedTriggerCount: 0, source: self.name, sourceId: self.id }
            if (st === 'poison') return { source: self.name, sourceId: self.id }
            return undefined
        }

        if (existing && buff?.stacking?.type === 'additive') {
            existing.restoreValue += stacks
            // 累加 attrMods
            if (buff.attrMods) {
                const scaledMods: Record<string, number> = {}
                for (const [attr, val] of Object.entries(buff.attrMods)) {
                    scaledMods[attr] = (val as number) * stacks
                }
                const newMods = applyAttrMods(enemy, engine, scaledMods, buff.name)
                if (!existing.mods) existing.mods = {}
                for (const [attr, val] of Object.entries(newMods)) {
                    existing.mods[attr] = (existing.mods[attr] ?? 0) + (val as number)
                }
                if ('agility' in scaledMods)
                    engine.state.turn.recalcInterval(enemy.id, enemy.attrs.get('agility'), enemy.getHaste())
            }
            // 重新调度 expiry（叠层刷新持续时间）
            if (buff.expiry?.type === 'duration') {
                engine.state.turn.removeEvents(`buff_end_${key}`)
                engine.state.turn.scheduleSystemEventAt(
                    `buff_end_${key}`,
                    engine.state.turn.currentTime + buff.expiry.ms,
                    'buff_end',
                )
            } else if (buff.expiry?.type === 'duration_by_attr') {
                engine.state.turn.removeEvents(`buff_end_${key}`)
                const duration = calcDebuffDuration(buff.expiry.multiplier, enemy.attrs.get(buff.expiry.attr))
                engine.state.turn.scheduleSystemEventAt(
                    `buff_end_${key}`,
                    engine.state.turn.currentTime + duration,
                    'buff_end',
                )
            }
            engine.emitLog({
                type: 'system',
                message: `${BattleLog.buffApply(buff?.name ?? e.buffId, enemy.name, buff?.description)} Lv.${existing.restoreValue}`,
                actorId: enemy.id,
            })
            engine.emit('on_debuff', self, enemy)
            if (e.buffId === 'poison') {
                engine.emit('on_poison', self, enemy)
                // 叠层时也需执行即时伤害 + 重新调度 tick
                tickEngine.afterApplyDebuff({
                    enemy,
                    engine,
                    tMs,
                    buffDef: buff,
                    stacks,
                    layerKey: key,
                    layer: existing,
                })
            }
            if (e.buffId === 'burn') {
                // 叠层时重新调度 tick
                engine.state.turn.removeEvents(`tick_burn_${enemy.id}`)
                engine.state.turn.scheduleSystemEventAt(
                    `tick_burn_${enemy.id}`,
                    engine.state.turn.currentTime + 1000,
                    'tick_burn',
                )
            }
            return
        }

        // 'none' 叠层 — 已有则跳过（如 sand_blind 不可叠加）
        if (existing && buff?.stacking?.type === 'none') {
            engine.emitLog({ type: 'system', message: `[${buff.name}] ${enemy.name} 已存在`, actorId: enemy.id })
            return
        }

        // 首次应用（independent/none/additive 首次均走此路径）
        const extra = makeExtra()
        const mods: Record<string, number> = {}
        const modDetails: string[] = []
        if (buff.attrMods) {
            const scaledMods: Record<string, number> = {}
            for (const [attr, val] of Object.entries(buff.attrMods)) {
                scaledMods[attr] = (val as number) * stacks
            }
            const result = applyAttrMods(enemy, engine, scaledMods, buff.name, buff.tags)
            for (const [attr, v] of Object.entries(result)) {
                modDetails.push(`${ATTR_CN[attr] ?? attr}${v > 0 ? '+' : ''}${v}`)
                mods[attr] = v as number
                if (attr === 'agility')
                    engine.state.turn.recalcInterval(enemy.id, enemy.attrs.get('agility'), enemy.getHaste())
            }
        }
        // stun 的 attrMods 在 afterApplyDebuff 中由 applyAttrMods 输出属性日志，此处不重复
        if (e.buffId !== 'stun') {
            engine.emitLog({
                type: 'system',
                message: modDetails.length
                    ? `${BattleLog.buffApply(buff?.name ?? e.buffId, enemy.name, buff?.description)} ${modDetails.join(', ')}`
                    : BattleLog.buffApply(buff?.name ?? e.buffId, enemy.name, buff?.description),
                actorId: enemy.id,
            })
        }
        engine.state.pendingBuffs.set(key, { restoreValue: stacks, mods, extra })

        // 调度 expiry
        if (buff.expiry?.type === 'duration') {
            engine.state.turn.scheduleSystemEventAt(
                `buff_end_${key}`,
                engine.state.turn.currentTime + buff.expiry.ms,
                'buff_end',
            )
        } else if (buff.expiry?.type === 'duration_by_attr') {
            const duration = calcDebuffDuration(buff.expiry.multiplier, enemy.attrs.get(buff.expiry.attr))
            engine.state.turn.scheduleSystemEventAt(
                `buff_end_${key}`,
                engine.state.turn.currentTime + duration,
                'buff_end',
            )
        }

        engine.emit('on_debuff', self, enemy)
        if (e.buffId === 'poison') engine.emit('on_poison', self, enemy)

        // 后处理（stun/poison/burn 额外逻辑）
        // 传入 layer 引用，让 tick engine 可以直接修改 mods
        tickEngine.afterApplyDebuff({
            enemy,
            engine,
            tMs,
            buffDef: buff,
            stacks,
            layerKey: key,
            layer: engine.state.pendingBuffs.get(key)!,
        })
    },
    add_buff({ eff, self, engine }: EffectCtx) {
        const e = eff as Extract<EffectDef, { type: 'add_buff' }>
        const key = `${e.buffId}::${self.id}`
        const buff = getBuff(e.buffId)

        const existing = engine.state.pendingBuffs.get(key)
        if (existing && buff?.stacking?.type === 'additive') {
            // 遍历身上所有已有 buff，收集 onBuffApply 加成
            let bonus = 0
            for (const [bk] of engine.state.pendingBuffs) {
                const parts = bk.split('::')
                if (parts[1] !== self.id) continue
                const bDef = getBuff(parts[0])
                if (bDef?.onBuffApply) bonus += bDef.onBuffApply(self, engine)
            }
            const max = (buff.stacking.max ?? Infinity) + bonus
            const newStacks = Math.min(max, existing.restoreValue + (e.stacks ?? 1))
            const delta = newStacks - existing.restoreValue
            if (delta <= 0) {
                // 已达上限，仍刷新持续时间
                if (buff.expiry?.type === 'duration') {
                    engine.state.turn.removeEvents(`buff_end_${key}`)
                    engine.state.turn.scheduleSystemEventAt(
                        `buff_end_${key}`,
                        engine.state.turn.currentTime + buff.expiry.ms,
                        'buff_end',
                    )
                }
                return
            }
            existing.restoreValue = newStacks
            engine.emitLog({
                type: 'system',
                message: `${BattleLog.buffApply(buff?.name ?? e.buffId, self.name)} Lv.${newStacks}${buff?.stacking?.max ? `/${buff.stacking.max}` : ''}`,
                actorId: self.id,
            })
            // 再应用 attrMods
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
            engine.emit('on_buff', self, engine.state.characters.find((c) => c.id !== self.id)!, e.buffId)
            return
        }

        // 先输出"获得状态"日志，再应用属性变化
        // 合并"获得状态"和属性变化为一条日志
        const modDetails: string[] = []
        const mods: Record<string, number> = {}
        if (buff?.attrMods) {
            const result = applyAttrMods(self, engine, buff.attrMods as Record<string, number>, buff.name, buff.tags)
            for (const [attr, v] of Object.entries(result)) {
                modDetails.push(`${ATTR_CN[attr] ?? attr}${v > 0 ? '+' : ''}${v}`)
                mods[attr] = v as number
                if (attr === 'agility')
                    engine.state.turn.recalcInterval(self.id, self.attrs.get('agility'), self.getHaste())
            }
        }
        const stacks = e.stacks ?? 1
        engine.emitLog({
            type: 'system',
            message: modDetails.length
                ? `${BattleLog.buffApply(buff?.name ?? e.buffId, self.name, buff?.description)} ${modDetails.join(', ')}${buff?.stacking?.type === 'additive' ? ` Lv.${stacks}${buff?.stacking?.max ? `/${buff.stacking.max}` : ''}` : ''}`
                : `${BattleLog.buffApply(buff?.name ?? e.buffId, self.name, buff?.description)}${buff?.stacking?.type === 'additive' ? ` Lv.${stacks}${buff?.stacking?.max ? `/${buff.stacking.max}` : ''}` : ''}`,
            actorId: self.id,
        })
        engine.state.pendingBuffs.set(key, { restoreValue: stacks, mods })
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
                // 部分移除时按比例回退 attrMods
                if (buff?.attrMods && layer.mods) {
                    const ratio = Math.abs(delta) / (layer.restoreValue - delta)
                    for (const [attr, val] of Object.entries(buff.attrMods)) {
                        const revertVal = Math.round((val as number) * delta * ratio)
                        if (revertVal !== 0) {
                            self.attrs.modify(attr as AttrName, revertVal)
                            layer.mods[attr] = (layer.mods[attr] ?? 0) + revertVal
                            if (attr === 'agility')
                                engine.state.turn.recalcInterval(self.id, self.attrs.get('agility'), self.getHaste())
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
        const targetDist = e.targetDist < 0 ? self.getMaxActionRange() : e.targetDist
        const moveDist = dist - targetDist
        if (e.useAp) {
            const apCost = Math.max(1, Math.ceil(Math.abs(moveDist) * 0.4))
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
    disarm({ eff, enemy, engine, action }: EffectCtx) {
        if (hasYuanYing(enemy, engine)) {
            engine.emitLog({ type: 'system', message: `[渊渟岳峙] ${enemy.name} 免疫缴械`, actorId: enemy.id })
            return
        }
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
            message: `[${action?.name ?? '点腕'}] ${BattleLog.name(enemy.name)} 兵器脱手！`,
            actorId: enemy.id,
        })
    },
    add_passive({ eff, self, engine }: EffectCtx) {
        const e = eff as Extract<EffectDef, { type: 'add_passive' }>
        self.addPassive(e.passiveId)
        const def = getPassive(e.passiveId)
        if (!def) return
        const enemy = engine.getOpponent(self.id)
        if (!enemy) return
        for (const slot of def.triggers ?? []) {
            if (slot.condition.type !== 'battle_start') continue
            if (slot.effects)
                for (const eff2 of slot.effects)
                    processActionEffect(eff2, self, enemy, engine, engine.state.turn.currentTime)
            if (slot.actionId) {
                const action = getAction(slot.actionId)
                if (action && action.apCost <= 2)
                    for (const eff2 of action.effects ?? [])
                        processActionEffect(eff2, self, enemy, engine, engine.state.turn.currentTime, action)
            }
        }
    },
    steal_artifact({ self, engine }: EffectCtx) {
        const enemy = engine.getOpponent(self.id)
        if (!enemy) return
        // 找对手可偷的奇物（非 inherent）
        const stealable = enemy.artifactDefs.filter((a) => !a.tags.includes('inherent'))
        if (stealable.length === 0) {
            engine.emitLog({ type: 'system', message: `[飞龙探云手] 对手无可偷取奇物`, actorId: self.id })
            return
        }
        // 成功概率
        const trackKey = `steal_artifact_track::${self.id}`
        const track = engine.state.pendingBuffs.get(trackKey)
        const chance = track?.restoreValue ?? 0.8
        const { success } = calcRoll(chance)
        if (!success) {
            engine.emitLog({
                type: 'system',
                message: `[飞龙探云手] 失手！(${Math.round(chance * 100)}%)`,
                actorId: self.id,
            })
            return
        }
        // 偷取第一个可偷奇物
        const target = stealable[0]
        const idx = enemy.artifactDefs.indexOf(target)
        if (idx !== -1) enemy.artifactDefs.splice(idx, 1)
        // 移除对手的奇物 triggers
        for (const t of target.triggers ?? []) {
            const tIdx = enemy.passiveTriggers.indexOf(t)
            if (tIdx !== -1) enemy.passiveTriggers.splice(tIdx, 1)
        }
        // 加给自己
        self.addArtifact(target.id)
        // 更新成功概率（减半）
        engine.state.pendingBuffs.set(trackKey, { restoreValue: chance / 2 })
        engine.emitLog({
            type: 'system',
            message: `[飞龙探云手] 得手！偷取了「${target.name}」（下次${Math.round((chance / 2) * 100)}%）`,
            actorId: self.id,
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
                        if (attr === 'agility')
                            engine.state.turn.recalcInterval(self.id, self.attrs.get('agility'), self.getHaste())
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
