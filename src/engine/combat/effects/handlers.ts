import type { EffectDef } from '../../entities/action'
import type { AttrName } from '../../entities/attributes'
import type { StatusType } from '../../entities/status'
import { calcBaseDamage, calcHealAmount, calcBuffDuration } from '../../calc/damage'
import { getWeapon } from '../../data/weapons'
import { getBuff } from '../../data/buffs'
import { genAppId } from '../../util/buff-utils'
import type { Tag } from '../../entities/tag'
import { scheduleBuffExpiry, revertBuffMods, clearWeaponBuffLayers, executeMove, revertWeaponStatBuffs } from '../utils'
import { BattleLog } from '../battle-log'
import type { EffectCtx } from './types'
import { applyDamage } from './damage'
import { handleStatusEffect } from './status'

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

        const existing = engine.state.pendingBuffs.get(key)
        if (existing && buff?.stacking?.type === 'additive') {
            const max = buff.stacking.max ?? Infinity
            const newStacks = Math.min(max, existing.restoreValue + (e.stacks ?? 1))
            const delta = newStacks - existing.restoreValue
            existing.restoreValue = newStacks
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
                engine.emitLog({
                    type: 'system',
                    message: `${getBuff(e.buffId)?.name ?? e.buffId} ${self.name} ${Math.abs(delta)}层→${layer.restoreValue}层`,
                    actorId: self.id,
                })
            }
            return
        }

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
        // 御物武器免疫缴械
        if (oldWeapon.tags.includes('imperial')) return
        const key = `disarmed::${enemy.id}`
        if (engine.state.pendingBuffs.has(key)) return
        revertWeaponStatBuffs(oldWeapon, enemy, engine)
        clearWeaponBuffLayers(enemy.id, engine)
        enemy.weaponDef = { ...getWeapon('bare_hands') }
        engine.state.pendingBuffs.delete(`dimensional_blade::${enemy.id}`)
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
