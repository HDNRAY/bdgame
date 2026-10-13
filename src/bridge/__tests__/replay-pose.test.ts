import { describe, it, expect, beforeEach } from 'vitest'
import { seedBattleRandom } from '../../engine/__tests__/seed-battle-random'
import { Character } from '../../engine/entities/character'
import { runBattle } from '../../engine/battle-runner'
import { gen, OPPONENTS } from '../../data/opponents/index'
import { BattleLog } from '../../engine/combat/battle-log'
import { allMainActions } from '../../data/actions'
import { ReplayEngine, actionPoseKind, type ActionPoseKind, type CharPose, type LogEntry } from '../replay-engine'
import type { BattleEvent, BattleSnapshot } from '../../engine/combat/types'
import type { ActionDefinition } from '../../engine/entities/action'

/**
 * 演出姿势分类（attack / buff / move）与六姿势回放。
 *
 * 口径（见 `replay-engine.ts` 的 actionPoseKind 注释）：
 * - 攻击类 → attack；移动类 → move（保持现状）；其余全部（用奇物/喝酒/上 buff/进架势/回血…）→ buff。
 * - 「攻击」= 走命中判定并对敌方结算进攻效果（damage / functional_damage / missing_hp_damage / add_debuff）；
 *   带 debuff 的攻击只要有伤害仍归 attack；辅助指令（pre_action/post_action）一律 buff。
 *
 * 下方 EXPECTED_POSE 是**逐条写死**的全表期望。它独立于实现：实现里的映射一旦被改回去
 * （例如重新要求 add_buff、或把辅助招判成 idle），这里立刻红灯。
 */

/** 命中判定后对敌方结算的进攻性效果 */
const OFFENSIVE_EFFECTS = ['damage', 'functional_damage', 'missing_hp_damage', 'add_debuff'] as const

/** 全招式期望姿势表（154 条；id → attack / buff / move） */
const EXPECTED_POSE: Record<string, ActionPoseKind> = {
    _adrenaline_shot: 'buff', // 肾上腺素针
    _alaya_insight: 'buff', // 阿赖耶识
    _arm_explosion: 'attack', // 自爆
    _braid_blade: 'attack', // 发辫刃
    _bu_lao_quan: 'buff', // 不老泉
    _cangfeng_mind_eye: 'buff', // 藏锋·心眼
    _chuan_yun: 'attack', // 穿云
    _detox: 'buff', // 解毒
    _detox_shot: 'buff', // 解毒针
    _eat_beans: 'buff', // 嚼茴香豆
    _fei_jian_shot: 'attack', // 一剑西来
    _fen_shen_shot: 'attack', // 分身攻击
    _field_dressing: 'buff', // 止血针
    _flying_lion_roar: 'attack', // 飞狮吼
    _generic_counter: 'attack', // 顺势反击
    _godspeed_counter: 'attack', // 疾风·雷闪
    _golden_bell_swing: 'attack', // 金玲索
    _huan_shot: 'attack', // 无人环撞击
    _iaijutsu_ready: 'buff', // 居合
    _iaijutsu_strike: 'attack', // 居合斩
    _jiu_ba_wang_zui: 'buff', // 霸王醉
    _jiu_nv_er_hong: 'buff', // 女儿红
    _ling_ao_chong: 'attack', // 灵鳌冲
    _lingbo_insight_step: 'buff', // 凌波微步
    _luo_yue: 'attack', // 落月
    _oil_splash: 'buff', // 泼油
    _orb_shot: 'attack', // 法珠冲击
    _qiti_awaken: 'buff', // 炁体源流·觉醒
    _resheath: 'buff', // 纳刀
    _sangui_heal: 'buff', // 三分归元
    _shao_dao_zi: 'buff', // 烧刀子
    _shuai_ren: 'attack', // 甩刃
    _silk_shot: 'attack', // 浮游丝
    _sonic_wave: 'attack', // 音波
    _tai_shang_heal: 'buff', // 太上御法
    _tiger_eye_foresight: 'buff', // 虎彻·看破
    _zhu_ye_qing: 'buff', // 竹叶青
    agility_steal: 'buff', // 汲灵
    ba_gua_you_shen_zhang: 'attack', // 八卦游身掌
    bi_hai_chao_sheng_qu: 'attack', // 碧海潮生曲
    big_leap: 'move', // 虎跃
    blaze_strike: 'attack', // 烈火
    blood_droplet: 'attack', // 血滴子
    blood_qi_protection: 'buff', // 血炁护体
    blowing_snow_sword: 'attack', // 吹雪剑法
    cang_niao_jian_fa: 'buff', // 苍鸟诀
    chanzi_heal: 'buff', // 甘露
    chanzi_stance: 'buff', // 金刚不坏
    cloud_hidden_sword: 'attack', // 云隐剑法
    condense_shield: 'buff', // 凝炁成盾
    crushing_blow: 'attack', // 石破天惊拳
    cun_jin: 'attack', // 寸劲
    cun_mang: 'attack', // 寸芒
    cyclone_slash: 'attack', // 旋风斩
    dao_ma_dan: 'buff', // 刀马旦
    dart_throw: 'attack', // 五芒镖
    deng_ping_du_shui: 'move', // 登萍度水
    desolate_palm: 'attack', // 黯然销魂掌
    dian_bu: 'move', // 瞬步
    dian_xue: 'attack', // 点穴
    drone_paralyze: 'attack', // 御物麻痹
    duan_bei_shou: 'attack', // 端杯手
    eighteen_palms: 'attack', // 飞龙在天
    electric_yoyo: 'attack', // 电力溜溜球
    fall_to_azure_sword: 'attack', // 碧落剑法
    feng_fan: 'move', // 凤反
    feng_hui: 'move', // 凤迴
    fissure: 'attack', // 裂地击
    flash: 'buff', // 闪光
    flick: 'attack', // 弹指
    follow_the_current: 'attack', // 顺水推舟
    gash: 'attack', // 切割
    gear_hang: 'buff', // 挂
    guard: 'buff', // 听潮式
    hammer_swing: 'attack', // 挥击
    hand_blade: 'attack', // 手刀
    heavy_slash: 'attack', // 蓄力斩
    horizontal_slash: 'attack', // 横斩
    iron_charge: 'attack', // 铁山靠
    jin_zhong_zhao: 'buff', // 金钟罩
    jindou: 'move', // 筋斗
    light_slash: 'attack', // 顺劈
    lightning_speed: 'move', // 电光石火
    ling_qi_guan_zhu: 'buff', // 灵炁灌注
    lion_roar: 'attack', // 狮吼功
    liu_yang_zhang: 'attack', // 六阳掌
    nine_deaths_strike: 'attack', // 九死剑法
    one_night_dance: 'attack', // 一夜鱼龙舞
    pickup_weapon: 'buff', // 拾起兵器
    po_lang_gun_fa: 'attack', // 破狼棍法
    poison_detonate: 'attack', // 毒素引爆
    pursuit_thrust: 'attack', // 螺旋刺击
    push_hand: 'attack', // 推掌
    push_palm: 'attack', // 流云手
    qi_blade: 'attack', // 炁刃
    qi_bolt: 'attack', // 元炁弹
    qi_bolt_2: 'attack', // 贰炁弹
    qi_bolt_3: 'attack', // 叁炁弹
    qi_bolt_4: 'attack', // 肆炁弹
    qi_gather: 'buff', // 聚炁
    qi_slash: 'attack', // 炁斩
    qinlong_gong: 'attack', // 擒龙功
    quanzhen_sword: 'attack', // 无假剑法
    rear_naked_choke: 'attack', // 裸绞
    restore_ap: 'buff', // 回炁
    retrieve_blade: 'buff', // 滚地拾刀
    return_spear: 'attack', // 回马枪
    rising_slash: 'attack', // 挑斩
    rod_cleave: 'attack', // 棍劈
    rod_lift: 'attack', // 棍挑
    rod_sweep: 'attack', // 横扫
    rod_thrust: 'attack', // 棍戳
    ru_lai_shen_zhang: 'attack', // 如来神掌
    ru_long: 'attack', // 如龙
    sand_throw: 'buff', // 抛沙
    santou_liubi: 'buff', // 三头六臂
    shadow_fist: 'attack', // 无影拳
    shadow_kick: 'attack', // 无影脚
    sheng_si_fu: 'attack', // 生死符
    shi_qi: 'buff', // 蚀炁
    side_kick: 'attack', // 侧踢
    sky_burner: 'attack', // 燎天裂地势
    spinning_kick: 'attack', // 回旋踢
    spinning_slash: 'attack', // 旋斩
    spirit_sword: 'buff', // 灵剑
    spring_bamboo_sword: 'attack', // 春竹剑法
    stand_rod_kick: 'attack', // 立棍踢
    steal_artifact: 'buff', // 探云手
    straight_punch: 'attack', // 虚实拳
    summon_haste: 'buff', // 御物加速
    sweep_kick: 'attack', // 扫腿
    swift_step: 'move', // 魅影步
    swift_thunder_sword: 'attack', // 迅雷剑法
    tempest: 'attack', // 暴雨梨花
    three_inch_light: 'attack', // 三寸光
    throwing_knife: 'attack', // 飞刀
    thrust: 'attack', // 暴烈刺击
    thunder_storm: 'attack', // 雷蛇
    thunder_strike: 'attack', // 雷霆一击
    tian_wai_fei_xian: 'attack', // 天外飞仙
    wan_fa_gui_yi: 'attack', // 万法归一
    wan_liu_gui_zong: 'buff', // 归宗式
    wind_hear: 'buff', // 听风式
    wrist_strike: 'attack', // 点腕
    wu_xiang_jian: 'buff', // 无想剑
    yan_quan: 'buff', // 焰拳
    yi_dian_han_mang: 'attack', // 一点寒芒
    yi_hui: 'attack', // 一辉
    yin_zhen: 'attack', // 银针
    yu_xiao_jian_fa: 'attack', // 玉箫剑法
    yufeng_needle: 'attack', // 玉蜂针
    yun_bu: 'move', // 云步
    yunv_sword: 'attack', // 流萤剑法
    zhemei_shou: 'attack', // 折梅手
}

/** 测试内独立重写一遍「判据」，用来交叉校验实现没有偏离注释里写的规则 */
function oracleKind(a: ActionDefinition): ActionPoseKind {
    const tags = a.tags ?? []
    if (tags.includes('move')) return 'move'
    if (tags.includes('pre_action') || tags.includes('post_action')) return 'buff'
    return (a.effects ?? []).some((e) => (OFFENSIVE_EFFECTS as readonly string[]).includes(e.type))
        ? 'attack'
        : 'buff'
}

describe('actionPoseKind · 全招式分类', () => {
    it('期望表覆盖全部招式（不多不少）', () => {
        expect(allMainActions.map((a) => a.id).sort()).toEqual(Object.keys(EXPECTED_POSE).sort())
    })

    it('每个招式的分类与写死的期望表一致', () => {
        const wrong: string[] = []
        for (const a of allMainActions) {
            const got = actionPoseKind(a.id)
            if (got !== EXPECTED_POSE[a.id]) wrong.push(`${a.id}(${a.name}) 期望 ${EXPECTED_POSE[a.id]} 实得 ${got}`)
        }
        expect(wrong).toEqual([])
    })

    it('分类与注释里的判据一致（独立重写一遍判据交叉校验）', () => {
        const wrong: string[] = []
        for (const a of allMainActions) {
            const got = actionPoseKind(a.id)
            const want = oracleKind(a)
            if (got !== want) wrong.push(`${a.id}(${a.name}) 期望 ${want} 实得 ${got}`)
        }
        expect(wrong).toEqual([])
    })

    it('非攻击非移动 ⇒ buff（逐条遍历全表）', () => {
        for (const a of allMainActions) {
            const kind = actionPoseKind(a.id)
            if (kind !== 'attack' && kind !== 'move') {
                expect(kind, `${a.id}(${a.name}) 非攻击非移动却不是 buff`).toBe('buff')
            }
        }
    })

    it('未登记的招式 id 保守按攻击（老日志 / 运行时 bonus 招）', () => {
        expect(actionPoseKind('not_a_real_action')).toBe('attack')
    })
})

// ── 回放层：事件 → 姿势 ──

function mkSnap(ap = 7): BattleSnapshot {
    return {
        time: 0,
        phase: 'fighting',
        distance: 4,
        characters: [
            {
                id: 'A',
                name: '甲',
                hp: 100,
                maxHp: 100,
                ap,
                maxAp: 7,
                chan: 0,
                pos: 0,
                weapon: 'bare_hands',
                spriteId: 'default',
                attrs: {},
                baseAttrs: {},
                buffs: [],
                attrBreakdown: { passives: {}, artifacts: {}, weapons: {} },
            },
            {
                id: 'B',
                name: '乙',
                hp: 100,
                maxHp: 100,
                ap: 7,
                maxAp: 7,
                chan: 0,
                pos: 4,
                weapon: 'bare_hands',
                spriteId: 'default',
                attrs: {},
                baseAttrs: {},
                buffs: [],
                attrBreakdown: { passives: {}, artifacts: {}, weapons: {} },
            },
        ],
        turn: { time: 0, queue: [] },
        pendingBuffs: [],
        actionCount: 0,
    }
}

/** 造一段回放日志（每个事件各占一个主招式 scope，同属回合 1） */
function mkLog(events: [BattleEvent, number][]): LogEntry[] {
    const log = new BattleLog()
    log.resetScope(1)
    for (const [evt, ms] of events) {
        log.beginMainAction()
        log.push(evt, ms)
    }
    return log.getAll()
}

/** 采样整条回放，收集每个角色出现过的姿势 */
function posesByChar(log: LogEntry[]): Map<string, Set<CharPose>> {
    const replay = new ReplayEngine(log)
    const out = new Map<string, Set<CharPose>>()
    for (let t = 0; t <= replay.totalDuration; t += 25) {
        for (const c of replay.getFrameAt(t).chars) {
            if (!out.has(c.id)) out.set(c.id, new Set())
            out.get(c.id)!.add(c.pose)
        }
    }
    replay.destroy()
    return out
}

const startLog = (): BattleEvent => ({ type: 'battle_start', actor: 'A', opponent: 'B', snapshot: mkSnap() })

/** 一个 attack_start 事件 */
function attackStart(actionId: string, actionName: string): BattleEvent {
    return {
        type: 'attack_start',
        actor: 'A',
        target: 'B',
        weapon: 'iron_sword',
        actionId,
        actionName,
        apCost: 2,
        apRemaining: 5,
        snapshot: mkSnap(5),
    }
}

describe('ReplayEngine · 辅助/非攻击招 → buff', () => {
    it('support 事件（甘露回血）在行动方为 buff，非行动方 idle', () => {
        const log = mkLog([
            [startLog(), 0],
            [
                {
                    type: 'support',
                    actor: 'A',
                    target: 'A',
                    actionId: 'chanzi_heal',
                    actionName: '甘露',
                    apCost: 2,
                    snapshot: mkSnap(5),
                },
                1000,
            ],
        ])
        const poses = posesByChar(log)
        expect(poses.get('A')!.has('buff')).toBe(true)
        expect(poses.get('B')!.has('buff')).toBe(false)
    })

    it('喝酒/减益/架势/聚炁/拾武等 support 事件也演 buff', () => {
        for (const actionId of ['_jiu_ba_wang_zui', 'flash', 'guard', 'qi_gather', 'pickup_weapon']) {
            const log = mkLog([
                [startLog(), 0],
                [
                    {
                        type: 'support',
                        actor: 'A',
                        target: 'A',
                        actionId,
                        actionName: actionId,
                        apCost: 1,
                        snapshot: mkSnap(6),
                    },
                    1000,
                ],
            ])
            expect(posesByChar(log).get('A')!.has('buff'), actionId).toBe(true)
        }
    })

    it('走攻击管道的非攻击招（触发回血 _tai_shang_heal / 回炁 restore_ap）也演 buff', () => {
        for (const [id, name] of [
            ['_tai_shang_heal', '太上御法'],
            ['restore_ap', '回炁'],
        ]) {
            const log = mkLog([[startLog(), 0], [attackStart(id, name), 1000]])
            expect(posesByChar(log).get('A')!.has('buff'), id).toBe(true)
        }
    })

    it('攻击招（顺劈）仍是 attack 而非 buff', () => {
        const log = mkLog([[startLog(), 0], [attackStart('light_slash', '顺劈'), 1000]])
        const poses = posesByChar(log).get('A')!
        expect(poses.has('attack')).toBe(true)
        expect(poses.has('buff')).toBe(false)
    })
})

describe('ReplayEngine · 防守方反应姿势（dodge / parry / hit）', () => {
    it('闪避：被打方演 dodge，出手方仍是 attack', () => {
        const log = mkLog([
            [startLog(), 0],
            [attackStart('light_slash', '顺劈'), 900],
            [
                {
                    type: 'check_hit',
                    actor: 'A',
                    target: 'B',
                    hitChance: 0.8,
                    roll: 0.95,
                    result: false,
                    snapshot: mkSnap(5),
                },
                1000,
            ],
            [{ type: 'dodge', actor: 'A', evader: 'B', snapshot: mkSnap(5) }, 1000],
        ])
        const poses = posesByChar(log)
        expect(poses.get('B')!.has('dodge')).toBe(true)
        expect(poses.get('B')!.has('hit')).toBe(false)
        expect(poses.get('A')!.has('attack')).toBe(true)
    })

    it('招架：被打方演 parry，出手方仍是 attack', () => {
        const log = mkLog([
            [startLog(), 0],
            [attackStart('light_slash', '顺劈'), 900],
            [{ type: 'parry', actor: 'A', parrier: 'B', parryChance: 0.5, roll: 0.1, snapshot: mkSnap(5) }, 1000],
        ])
        const poses = posesByChar(log)
        expect(poses.get('B')!.has('parry')).toBe(true)
        expect(poses.get('A')!.has('attack')).toBe(true)
    })

    it('吃伤害：被打方演 hit', () => {
        const log = mkLog([
            [startLog(), 0],
            [attackStart('light_slash', '顺劈'), 900],
            [
                {
                    type: 'damage',
                    actor: 'A',
                    target: 'B',
                    actionId: 'light_slash',
                    actionName: '顺劈',
                    base: 10,
                    distanceMult: 1,
                    isCrit: false,
                    isParried: false,
                    final: 10,
                    blocked: 0,
                    snapshot: mkSnap(5),
                },
                1000,
            ],
        ])
        expect(posesByChar(log).get('B')!.has('hit')).toBe(true)
    })

    it('被招架的伤害事件仍演 parry（parry > hit，不切回 hit）', () => {
        const log = mkLog([
            [startLog(), 0],
            [attackStart('light_slash', '顺劈'), 900],
            [
                {
                    type: 'damage',
                    actor: 'A',
                    target: 'B',
                    actionId: 'light_slash',
                    actionName: '顺劈',
                    base: 10,
                    distanceMult: 1,
                    isCrit: false,
                    isParried: true,
                    final: 3,
                    blocked: 7,
                    snapshot: mkSnap(5),
                },
                1000,
            ],
        ])
        const poses = posesByChar(log).get('B')!
        expect(poses.has('parry')).toBe(true)
        expect(poses.has('hit')).toBe(false)
    })

    it('移动：move 事件仍是 move 姿势（未被改动）', () => {
        const log = mkLog([
            [startLog(), 0],
            [
                {
                    type: 'move',
                    actor: 'A',
                    delta: -1,
                    newDistance: 3,
                    apCost: 1,
                    apRemaining: 6,
                    durationMs: 300,
                    kind: 'move',
                    snapshot: mkSnap(6),
                },
                1000,
            ],
        ])
        expect(posesByChar(log).get('A')!.has('move')).toBe(true)
    })
})

/**
 * 端到端：真打一场（引擎日志 → ReplayEngine），确认实际放出的非攻击招会播 buff 姿势。
 */
describe('真实战斗回放 · buff 姿势', () => {
    beforeEach(() => seedBattleRandom())

    it('战斗日志里的加状态/辅助招会在回放里出现 buff 姿势', () => {
        const xiaohua = OPPONENTS.find((o) => o.id === 'xiaohua')!
        const yidao = OPPONENTS.find((o) => o.id === 'yidao')!
        const { engine } = runBattle(new Character(gen(xiaohua, 33)), new Character(gen(yidao, 33)), undefined, 4, false)
        const entries = engine.state.log.getAll()
        const buffSupports = entries.filter(
            (e) => e.event.type === 'support' && actionPoseKind(e.event.actionId) === 'buff',
        )
        expect(buffSupports.length).toBeGreaterThan(0)

        const poses = posesByChar(entries)
        expect([...poses.values()].some((s) => s.has('buff'))).toBe(true)
    })
})
