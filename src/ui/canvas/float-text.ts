import * as PIXI from 'pixi.js'
import type { FrameChar } from '../../bridge/replay-engine'
import type { BattleEvent } from '../../engine/combat/types'
import {
    FLOAT_LIFE,
    FLOAT_DT,
    FLOAT_RISE_SPEED,
    FLOAT_FADE_START,
    TEXT_STACK_V,
    TEXT_STACK_H,
    TEXT_EFFECT_OFFSET,
} from './constants'

interface FloatEntry {
    obj: PIXI.Text
    life: number
    maxLife: number
}

interface FloatData {
    text: string
    color: string
    charId: string
    kind: 'action' | 'effect'
}

export class FloatTextSystem {
    private texts: FloatEntry[] = []
    private hasPlayed = false
    private container: PIXI.Container
    /** 待生成的浮动文字队列 */
    private pendingSpawns: (() => void)[] = []
    private lastSpawnTime = 0
    private readonly SPAWN_INTERVAL = 150

    constructor(container: PIXI.Container) {
        this.container = container
    }

    /** 将一个事件加入浮动文字队列 */
    spawn(
        event: BattleEvent,
        actionName: string | undefined,
        chars: FrameChar[],
        pxPerUnit: number,
        viewOffset: number,
        groundY: number,
        charDims: Map<string, { w: number; h: number }>,
    ): void {
        if (!this.hasPlayed) return

        const data = this.getFloatData(event, actionName)
        if (!data) return

        const char = chars.find((c) => c.id === data.charId) ?? chars[0]
        const isSelf = data.kind === 'action'
        const dim = charDims.get(char.id) ?? { w: 48, h: 48 }

        let ox: number
        let oy: number
        if (isSelf) {
            ox = this.container.width / 2
            oy = 40
        } else {
            const charCenterX = this.container.width / 2 + (char.pos - viewOffset) * pxPerUnit
            const mid = this.container.width / 2
            ox = charCenterX + (charCenterX < mid ? TEXT_EFFECT_OFFSET : -TEXT_EFFECT_OFFSET)
            oy = groundY - dim.h + 20
        }

        // 延迟到执行时才计算位置（此时 this.texts 已包含之前显示的文字）
        this.pendingSpawns.push(() => {
            // 重新计算同类堆叠偏移
            const sameType = this.texts.filter((t) => t.obj.text === data.text).length
            let fx = ox
            let fy = oy - sameType * TEXT_STACK_V
            const SPACING = 18
            const candidates = [
                [0, -sameType * TEXT_STACK_V],
                [TEXT_STACK_H, -TEXT_STACK_V - sameType * TEXT_STACK_V],
                [-TEXT_STACK_H, -TEXT_STACK_V * 2 - sameType * TEXT_STACK_V],
                [TEXT_STACK_H * 2, -TEXT_STACK_V * 2 - sameType * TEXT_STACK_V],
                [0, -TEXT_STACK_V * 3 - sameType * TEXT_STACK_V],
                [-TEXT_STACK_H * 2, -TEXT_STACK_V - sameType * TEXT_STACK_V],
                [TEXT_STACK_H * 3, -TEXT_STACK_V * 3 - sameType * TEXT_STACK_V],
                [-TEXT_STACK_H * 3, -TEXT_STACK_V * 3 - sameType * TEXT_STACK_V],
            ]
            for (const [cx, cy] of candidates) {
                const px = ox + cx
                const py = oy + cy
                const hit = this.texts.some((t) => Math.abs(t.obj.x - px) < SPACING && Math.abs(t.obj.y - py) < SPACING)
                if (!hit) {
                    fx = ox + cx
                    fy = oy + cy
                    break
                }
            }
            const obj = new PIXI.Text({
                text: data.text,
                style: { fontFamily: 'monospace', fontSize: 12, fill: data.color, fontWeight: 'bold' },
            })
            obj.anchor.set(0.5, 0.5)
            obj.x = fx
            obj.y = fy
            this.container.addChild(obj)
            this.texts.push({ obj, life: FLOAT_LIFE, maxLife: FLOAT_LIFE })
        })
    }

    /** 每帧更新：处理队列（按间隔逐个显示）+ 上浮 + 淡出 */
    update(): void {
        // 按间隔从队列中取出并真正创建文字
        const now = performance.now()
        while (this.pendingSpawns.length > 0 && now - this.lastSpawnTime >= this.SPAWN_INTERVAL) {
            this.lastSpawnTime = now
            this.pendingSpawns.shift()!()
        }

        for (let i = this.texts.length - 1; i >= 0; i--) {
            const ft = this.texts[i]
            ft.life -= FLOAT_DT
            const fadeStart = ft.maxLife * FLOAT_FADE_START
            if (ft.life > fadeStart) {
                ft.obj.y -= FLOAT_RISE_SPEED // 前 70% 上浮
            }
            ft.obj.alpha = ft.life > fadeStart ? 1 : Math.max(0, ft.life / fadeStart) // 后 30% 淡出
            if (ft.life <= 0) {
                this.container.removeChild(ft.obj)
                ft.obj.destroy()
                this.texts.splice(i, 1)
            }
        }
    }

    /** 标记已开始播放 */
    markPlayed(): void {
        this.hasPlayed = true
    }

    get hasPlayedStatus(): boolean {
        return this.hasPlayed
    }

    /** 清理 */
    destroy(): void {
        for (const ft of this.texts) {
            this.container.removeChild(ft.obj)
            ft.obj.destroy()
        }
        this.texts = []
        this.hasPlayed = false
    }

    // ── 私有 ──

    private parseBuffName(msg: string): string {
        const m = msg.match(/^\[(.+?)\]/)
        return m ? m[1] : msg
    }

    private getFloatData(event: BattleEvent, actionName: string | undefined): FloatData | null {
        switch (event.type) {
            case 'attack_start':
                return { text: actionName ?? '攻击', color: '#ffffff', charId: event.actor, kind: 'action' }
            case 'damage':
                return {
                    text: event.isCrit ? `暴击 ${event.final}` : `${event.final}`,
                    color: event.isCrit ? '#ffd700' : '#ff4444',
                    charId: event.target,
                    kind: 'effect',
                }
            case 'dodge':
                return { text: '闪避', color: '#ffffff', charId: event.evader, kind: 'effect' }
            case 'parry':
                return { text: '招架', color: '#ffffff', charId: event.parrier, kind: 'effect' }
            case 'check_hit':
                return event.result ? null : { text: '未命中', color: '#888', charId: event.target, kind: 'effect' }
            case 'defeat':
                return { text: '败北', color: '#ff4444', charId: event.loser, kind: 'effect' }
            case 'system':
                return event.message
                    ? {
                          text: this.parseBuffName(event.message),
                          color: '#4ecdc4',
                          charId: event.actor ?? '',
                          kind: 'effect',
                      }
                    : null
            case 'battle_start':
                return { text: '战斗开始', color: '#4ecdc4', charId: event.actor, kind: 'action' }
            default:
                return null
        }
    }
}
