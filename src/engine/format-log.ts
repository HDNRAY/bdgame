import { BattleLog } from './combat/battle-log'
import type { BattleSnapshot } from './combat/types'

/** 符号体系:
 *  「」 人名    # 主动行动    ↳ 触发招式    + 辅招
 *  ()  AP消耗   → 方向/目标   » 判定结果    · 率·骰分隔
 *  []  状态名   |  信息分隔
 */

/** 从快照计算移动前距离 */
function calcOldDist(delta: number, snapshot: BattleSnapshot, actorId: string): number {
    const mover = snapshot.characters.find((c) => c.id === actorId)
    const opponent = snapshot.characters.find((c) => c.id !== actorId)
    if (!mover || !opponent) return 0
    // delta 是位置位移量，老位置 = 新位置 - delta
    return Math.abs(mover.pos - delta - opponent.pos)
}

/** 从快照构建 id→name 映射 */
function buildNameMap(snapshot: BattleSnapshot): Map<string, string> {
    const map = new Map<string, string>()
    for (const c of snapshot.characters) {
        map.set(c.id, c.name)
    }
    return map
}

export function formatBattleLog(log: BattleLog): { lines: string[]; eventToLine: number[] } {
    // 严格按 id（插入序 = 执行序）排序；原子回合下整回合同 timelineMs，排序必须以 id 为准
    const all = [...log.getAll()].sort((a, b) => a.id - b.id)
    const lines: string[] = []
    // eventToLine[i] = 事件 i 处理完后可见的最后一行索引（含）
    const eventToLine: number[] = []
    const nameMap = all.length > 0 ? buildNameMap(all[0].event.snapshot) : new Map<string, string>()
    const fmtName = (id: string, snap?: BattleSnapshot): string => {
        let name = id
        if (snap) {
            for (const c of snap.characters)
                if (c.id === id) {
                    name = c.name
                    break
                }
        } else {
            name = nameMap.get(id) ?? id
        }
        return `「${name}」`
    }

    function hpInfo(actorId: string, s: BattleSnapshot): string {
        const c0 = s.characters[0]
        const c1 = s.characters[1]
        const [first, second] = c0.id === actorId ? [c0, c1] : [c1, c0]
        const h0 = Math.round(first.hp * 10) / 10
        const h1 = Math.round(second.hp * 10) / 10
        let info = `HP${h0}/${first.maxHp} VS HP${h1}/${second.maxHp}`
        // 查 actor 的缠层数
        const actor = c0.id === actorId ? c0 : c1
        if (actor.chan > 0) info += ` 缠${actor.chan}`
        return info
    }

    function t(ms: number) {
        return `${(ms / 1000).toFixed(2)}s`
    }

    /** 率·骰 统一格式 */
    function roll(kind: string, rate: number, rollVal: number): string {
        return `${kind}${(rate * 100).toFixed(0)}%·${(rollVal * 100).toFixed(0)}%`
    }

    /** 由作用域推导缩进层级：主招式(2)→0、反应(3)→1、子反应(4)→2… */
    function scopeIndent(s: number[] | undefined): number {
        return Math.max(0, (s?.length ?? 2) - 2)
    }
    /** frameScope 是否为 eventScope 的前缀（或相等） */
    function isPrefix(frameScope: number[], eventScope: number[] | undefined): boolean {
        if (!eventScope || frameScope.length > eventScope.length) return false
        for (let i = 0; i < frameScope.length; i++) if (frameScope[i] !== eventScope[i]) return false
        return true
    }

    /** 一个招式帧（攻击/触发招式），children 为其效果行与已完成的子反应行 */
    interface Frame {
        scope: number[]
        depth: number
        prefix: string
        text: string
        inline: string
        ap: string
        actionName?: string
        preLines: string[]
        children: string[]
    }

    const stack: Frame[] = []
    /** 当前块的去重键（回合_行动者）；反应（scope≥3）不触发换块 */
    let currentBlockKey = ''
    /** 击杀奖杯胜者（延迟到末尾输出） */
    let defeatWinner = ''
    /** battle_start 头部是否已输出 */
    let headerShown = false

    /** 渲染一个招式帧为若干行（前摇行 + 招式行 + 效果/子反应行） */
    function renderFrame(f: Frame): string[] {
        const out: string[] = []
        for (const p of f.preLines) out.push(p)
        // 主招式(depth0)=2空格、反应(depth1)=4空格、子反应(depth2)=6空格…
        let line = `${'  '.repeat(f.depth + 1)}${f.prefix}${f.text}`
        if (f.inline) line += f.inline
        if (f.ap) line += f.ap
        out.push(line)
        for (const c of f.children) out.push(c)
        return out
    }

    /** 弹出栈顶直至 top.scope 是 scope 的前缀（或栈空）；被弹出的帧渲染后挂到父帧 children */
    function popTo(scope: number[]): Frame | null {
        while (stack.length > 0 && !isPrefix(stack[stack.length - 1].scope, scope)) {
            const f = stack.pop()!
            const parent = stack.length > 0 ? stack[stack.length - 1] : null
            const rendered = renderFrame(f)
            if (parent) parent.children.push(...rendered)
            else lines.push(...rendered)
        }
        return stack.length > 0 ? stack[stack.length - 1] : null
    }

    /** 关闭当前块：清空剩余栈（通常是主帧） */
    function closeBlock() {
        popTo([-1])
        stack.length = 0
        currentBlockKey = ''
    }

    /** 打开块标题 */
    function openBlock(
        ms: number,
        actorId: string,
        snapshot: BattleSnapshot,
        opts?: { displayName?: string; useCurrentAp?: boolean },
    ) {
        const actorName = opts?.displayName ?? fmtName(actorId, snapshot)
        if (lines.length > 0) lines.push('')
        const hp = hpInfo(actorId, snapshot)
        const d = ` ${snapshot.distance.toFixed(1)}m`
        const num = snapshot.actionCount > 0 ? ` #${snapshot.actionCount}` : ''
        const c = snapshot.characters.find((x) => x.id === actorId)
        // 普通回合显示 maxAp（原子回合=满 AP）；召唤物回合显示主人当前 AP（御物耗炁可见）
        const apVal = opts?.useCurrentAp ? c?.ap : c?.maxAp
        const ap = c && apVal && apVal > 0 ? ` AP${apVal.toFixed(1)}` : ''
        lines.push(`── ${t(ms)}${num} ${actorName}${ap} ${hp}${d} ──`)
    }

    /** 主级事件（回合级或主招式）→ 按 (回合,行动者) 换块 */
    function ensureBlock(
        ms: number,
        actorId: string | undefined,
        snapshot: BattleSnapshot | undefined,
        turn: number,
        opts?: { displayName?: string; useCurrentAp?: boolean },
    ) {
        if (!snapshot || !actorId) return
        const key = `${turn}_${actorId}_${opts?.displayName ?? ''}`
        if (key !== currentBlockKey) {
            closeBlock()
            currentBlockKey = key
            openBlock(ms, actorId, snapshot, opts)
        }
    }

    for (let eventIdx = 0; eventIdx < all.length; eventIdx++) {
        const { event: e, timelineMs: ms } = all[eventIdx]
        const before = lines.length
        const sc = e.scope ?? []

        switch (e.type) {
            case 'battle_start':
                if (!headerShown) {
                    lines.push(`── ${fmtName(e.actor, e.snapshot)} VS ${fmtName(e.opponent, e.snapshot)} ──`)
                    headerShown = true
                }
                break

            case 'attack_start': {
                const depth = scopeIndent(sc)
                const isReaction = sc.length >= 3
                const targetName = fmtName(e.target, e.snapshot)
                const text = `${e.actionName ?? e.weapon}(${e.apCost}AP) → ${targetName}`
                const prefix = isReaction ? '↳ ' : e.isBonus ? '+ ' : '# '
                const ap = `  | AP${e.apRemaining.toFixed(1)}`

                if (isReaction) {
                    // 反应招式：弹出直到父帧是前缀，然后压栈
                    popTo(sc)
                    stack.push({
                        scope: sc,
                        depth,
                        prefix,
                        text,
                        inline: '',
                        ap,
                        actionName: e.actionName,
                        preLines: [],
                        children: [],
                    })
                } else {
                    // 主招式：换块 + 压入主帧（召唤物回合用召唤物名归块，与主人动作分开）
                    const blockOpts = e.summonName
                        ? { displayName: `「${e.summonName}」`, useCurrentAp: true }
                        : undefined
                    ensureBlock(ms, e.actor, e.snapshot, sc[0] ?? 0, blockOpts)
                    closeBlock()
                    currentBlockKey = `${sc[0] ?? 0}_${e.actor}_${e.summonName ?? ''}`
                    stack.push({
                        scope: sc,
                        depth,
                        prefix,
                        text,
                        inline: '',
                        ap,
                        actionName: e.actionName,
                        preLines: [],
                        children: [],
                    })
                }
                break
            }

            case 'move': {
                // 移动：回合级（scope 1）或主招式内（scope 2）→ 块内行；更深（dash 冲刺）→ 挂帧前摇行
                if (sc.length <= 2) {
                    ensureBlock(ms, e.actor, e.snapshot, sc[0] ?? 0)
                    const oldDist = calcOldDist(e.delta, e.snapshot, e.actor)
                    const apInfo = e.apCost > 0 ? `  | AP${e.apRemaining.toFixed(1)}` : ''
                    lines.push(`  # 移动  ${oldDist.toFixed(1)}→${e.newDistance.toFixed(1)}m${apInfo}`)
                } else {
                    const f = popTo(sc)
                    if (f) {
                        const oldDist = calcOldDist(e.delta, e.snapshot, e.actor)
                        f.preLines.push(
                            `${'  '.repeat(f.depth + 1)}# 移动  ${oldDist.toFixed(1)}→${e.newDistance.toFixed(1)}m`,
                        )
                    }
                }
                break
            }

            case 'check_hit': {
                const f = popTo(sc)
                if (f) {
                    f.inline += `  ${roll('命中', e.hitChance, e.roll)}`
                    if (!e.result) {
                        f.inline += '  » 未命中'
                        f.ap = ''
                    }
                }
                break
            }

            case 'dodge': {
                const f = popTo(sc)
                if (f) {
                    if (!f.inline.includes('未命中')) f.inline += `  » ${fmtName(e.evader, e.snapshot)} 闪避`
                }
                break
            }

            case 'parry': {
                const f = popTo(sc)
                if (f && e.parryChance != null && e.roll != null) {
                    f.inline += `  ${roll('招架', e.parryChance, e.roll)}`
                }
                break
            }

            case 'check_crit': {
                const f = popTo(sc)
                if (f) f.inline += `  ${roll('暴击', e.critChance, e.roll)}`
                break
            }

            case 'damage': {
                const resultText = `${
                    e.isParried && e.blocked > 0 ? `格挡${e.blocked.toFixed(1)}  ` : ''
                }造成${e.final.toFixed(1)}`
                const f = popTo(sc)
                if (f) {
                    if (!f.inline.includes('未命中') && !f.inline.includes('闪避')) {
                        f.inline += `  » ${resultText}`
                    }
                } else {
                    const label = e.actionName !== '未知' ? `[${e.actionName}] ` : ''
                    lines.push(`    ↳ ${label}${resultText}`)
                }
                break
            }

            case 'defeat': {
                // 推迟奖杯到末尾，保证结算事件都在奖杯之前
                const winnerId = e.winner
                defeatWinner = e.snapshot?.characters.find((c) => c.id === winnerId)?.name ?? winnerId
                break
            }

            case 'system': {
                if (sc.length <= 1) {
                    // 回合级系统行（战斗开始 buff、架势切换、状态到期等）
                    ensureBlock(ms, e.actor, e.snapshot, sc[0] ?? 0)
                    const prefix = e.message.startsWith('[') ? '· ' : ''
                    lines.push(`  ${prefix}${e.message}`)
                } else {
                    // 效果行：挂到所属招式帧（缩进 = 帧深度 + 1）
                    const f = popTo(sc)
                    if (f) {
                        f.children.push(`${'  '.repeat(f.depth + 2)}↳ ${e.message}`)
                    } else {
                        lines.push(`  · ${e.message}`)
                    }
                }
                break
            }
        }

        // 记录该事件处理完后可见的最后一行索引
        if (lines.length > before) {
            eventToLine[eventIdx] = lines.length - 1
        }
    }
    // 填充事件本身没加行的情况（沿用上一事件的结尾）
    for (let i = 0; i < all.length; i++) {
        if (eventToLine[i] === undefined) {
            eventToLine[i] = i > 0 ? eventToLine[i - 1] : -1
        }
    }
    closeBlock()
    // 击杀奖杯推迟到这里输出（保证所有结算事件都在奖杯之前）
    if (defeatWinner) {
        lines.push(`\n🏆 ${defeatWinner} 获胜！`)
    }
    eventToLine[all.length - 1] = lines.length - 1
    return { lines, eventToLine }
}
