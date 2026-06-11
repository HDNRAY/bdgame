import type { LogEvent } from './log-events'

interface ActionStat {
    actionId: string
    actionName: string
    sourceId: string
    totalDamage: number
    hitCount: number
    dotDamage: number
    totalHeal: number
}

function key(actionId: string, sourceId: string): string {
    return `${actionId}::${sourceId}`
}

export class StatsTracker {
    byAction = new Map<string, ActionStat>()
    totalDirectDamage = 0
    totalDotDamage = 0
    totalHeal = 0

    get totalDamage(): number {
        return this.totalDirectDamage + this.totalDotDamage
    }

    handle(event: LogEvent): void {
        switch (event.type) {
            case 'damage': {
                this.totalDirectDamage += event.final
                const k = key(event.actionId, event.sourceId)
                let s = this.byAction.get(k)
                if (!s) {
                    s = {
                        actionId: event.actionId,
                        actionName: event.actionName,
                        sourceId: event.sourceId,
                        totalDamage: 0,
                        hitCount: 0,
                        dotDamage: 0,
                        totalHeal: 0,
                    }
                    this.byAction.set(k, s)
                }
                s.totalDamage += event.final
                s.hitCount++
                break
            }

            case 'heal': {
                this.totalHeal += event.amount
                const src = event.sourceId ?? event.targetId
                const k = key('_heal', src)
                let s = this.byAction.get(k)
                if (!s) {
                    s = {
                        actionId: '_heal',
                        actionName: '治疗',
                        sourceId: src,
                        totalDamage: 0,
                        hitCount: 0,
                        dotDamage: 0,
                        totalHeal: 0,
                    }
                    this.byAction.set(k, s)
                }
                s.totalHeal += event.amount
                break
            }

            case 'damage_over_time': {
                this.totalDotDamage += event.amount
                const aid = event.actionId ?? 'dot'
                const src = event.sourceId ?? '?'
                const k = key(aid, src)
                let s = this.byAction.get(k)
                if (!s) {
                    s = {
                        actionId: aid,
                        actionName: event.actionName ?? 'dot',
                        sourceId: src,
                        totalDamage: 0,
                        hitCount: 0,
                        dotDamage: 0,
                        totalHeal: 0,
                    }
                    this.byAction.set(k, s)
                }
                s.dotDamage += event.amount
                break
            }

            case 'overheat': {
                this.totalDotDamage += event.damage
                const k = key('permanent_burn', 'overheat')
                let s = this.byAction.get(k)
                if (!s) {
                    s = {
                        actionId: 'permanent_burn',
                        actionName: '过热',
                        sourceId: '',
                        totalDamage: 0,
                        hitCount: 0,
                        dotDamage: 0,
                        totalHeal: 0,
                    }
                    this.byAction.set(k, s)
                }
                s.dotDamage += event.damage
                break
            }
        }
    }

    format(charNames?: Record<string, string>): string[] {
        const lines: string[] = []
        // 按角色分组
        const byChar = new Map<string, ActionStat[]>()
        for (const s of this.byAction.values()) {
            const arr = byChar.get(s.sourceId) ?? []
            arr.push(s)
            byChar.set(s.sourceId, arr)
        }

        for (const [srcId, stats] of byChar) {
            const who = charNames?.[srcId] ?? srcId
            const total = stats.reduce((s, a) => s + a.totalDamage + a.dotDamage, 0)
            const heal = stats.reduce((s, a) => s + a.totalHeal, 0)
            lines.push(`\n── ${who} ──`)
            const sorted = [...stats].sort((a, b) => b.totalDamage + b.dotDamage - (a.totalDamage + a.dotDamage))
            for (const s of sorted) {
                const dmg = Math.round((s.totalDamage + s.dotDamage) * 10) / 10
                const pct = total > 0 ? ((dmg / total) * 100).toFixed(1) : '0.0'
                const dotStr = s.totalDamage > 0 && s.dotDamage > 0 ? ` (dot ${Math.round(s.dotDamage * 10) / 10})` : ''
                const healStr = s.totalHeal > 0 ? ` [治疗 ${Math.round(s.totalHeal * 10) / 10}]` : ''
                lines.push(`  ${s.actionName}: ${dmg} (${pct}%)${dotStr}${healStr}`)
            }
            if (heal > 0) lines.push(`  治疗合计: ${Math.round(heal * 10) / 10}`)
            const showTotal = Math.round(total * 10) / 10
            const showDirect = Math.round((total - stats.reduce((s, a) => s + a.dotDamage, 0)) * 10) / 10
            const showDot = Math.round(stats.reduce((s, a) => s + a.dotDamage, 0) * 10) / 10
            const parts: string[] = []
            if (showDirect > 0) parts.push(`直接 ${showDirect}`)
            if (showDot > 0) parts.push(`dot ${showDot}`)
            const healPart = heal > 0 ? ` | 治疗 ${Math.round(heal * 10) / 10}` : ''
            lines.push(`  总计: ${showTotal} 伤害 (${parts.join(' + ')})${healPart}`)
        }

        return lines
    }
}
