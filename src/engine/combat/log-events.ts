import type { Tag } from '../entities/tag'

/** 日志事件 —— 战斗中的一切可记录/可统计的事件 */
export type LogEvent =
    | { type: 'battle_start'; actorId: string; opponentId: string }
    | { type: 'defeat'; loserId: string; winnerId: string }
    | {
          type: 'attack_start'
          actionId: string
          actionName: string
          weapon: string
          sourceId: string
          targetId: string
          apCost: number
          apRemaining: number
          triggered: boolean
          bonus?: boolean
          indent: number
      }
    | { type: 'check_hit'; sourceId: string; targetId: string; hitChance: number; roll: number; result: boolean }
    | { type: 'check_parry'; sourceId: string; targetId: string; parryChance: number; roll: number; result: boolean }
    | { type: 'check_crit'; sourceId: string; critChance: number; roll: number; result: boolean }
    | {
          type: 'damage'
          actionId: string
          actionName: string
          sourceId: string
          targetId: string
          base: number
          final: number
          blocked: number
          isCrit: boolean
          isParried: boolean
          tags: Tag[]
      }
    | {
          type: 'damage_over_time'
          actionId?: string
          actionName?: string
          sourceId?: string
          targetId: string
          status: string
          amount: number
      }
    | { type: 'heal'; actionId?: string; actionName?: string; sourceId?: string; targetId: string; amount: number }
    | { type: 'move'; sourceId: string; delta: number; newDistance: number; apCost: number; apRemaining: number }
    | {
          type: 'status_apply'
          actionId: string
          actionName: string
          sourceId: string
          targetId: string
          status: string
          stacks: number
          chance: number
          success: boolean
      }
    | { type: 'status_tick'; targetId: string; status: string; amount: number; nextTickMs: number }
    | { type: 'buff_apply'; buffId: string; targetId: string; label: string }
    | { type: 'buff_end'; buffId: string; targetId: string; label: string; remaining: number }
    | { type: 'stat_change'; targetId: string; attr: string; delta: number; label: string }
    | { type: 'fumble'; sourceId: string }
    | { type: 'overheat'; targetId: string; damage: number }
    | { type: 'interrupt'; sourceId: string; targetId: string }
    | { type: 'dodged'; sourceId: string; targetId: string }
    | { type: 'parried'; sourceId: string; targetId: string }
    | { type: 'knockback'; sourceId: string; targetId: string; distance: number }
    | { type: 'cleanse'; sourceId: string; targetId: string; statuses?: string[] }
    | { type: 'system'; message: string; actorId?: string }
