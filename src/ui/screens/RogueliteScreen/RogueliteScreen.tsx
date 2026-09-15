import type { ReactElement } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useRogueliteStore } from '../../stores/roguelite-store'
import { useOrientation } from '../../hooks/useOrientation'
import { useNavigate } from 'react-router-dom'
import { CharacterPanel } from '../../components/CharacterPanel/CharacterPanel'
import { NodeMap } from '../../components/roguelite/NodeMap'
import { InjuryBar } from '../../components/roguelite/InjuryBar'
import { RoundCard } from '../../components/roguelite/RoundCard'
import { IntroOverlay } from '../../components/roguelite/IntroOverlay'
import { BattlePanel } from '../../components/BattlePanel/BattlePanel'
import { buildBattleDataFromEntries } from '../../components/roguelite/battle-replay'
import { gen, getOpponentDef } from '../../../data/opponents'
import type { CharacterBuild } from '../../../game/entities/character-build'
import type { Round } from '../../../game/entities/round'
import {
    WORLD_INTRO,
    CHAPTER1_INTRO,
    CHAPTERS,
    ENDING_NAMES,
    ENDING_NAME_DEFAULT,
    ENDING_NAME_FALLEN,
    STORY_INTRO_TEXT,
    TRUE_ENDING_EPILOGUE,
} from '../../../data/story-intros'
import './RogueliteScreen.scss'

const CHAPTER_CN = ['', '一', '二', '三']

export function RogueliteScreen() {
    /** 展开观看的教学轮（默认折叠，不展开就不播回放） */
    const [openTutorials, setOpenTutorials] = useState<Record<string, boolean>>({})
    const {
        engine,
        gameState,
        mode,
        select,
        setMode,
        saveBuild,
        reset,
        worldIntroShown,
        chapterIntro,
        endingSeen,
        confirmWorldIntro,
        confirmChapterIntro,
        confirmEnding,
    } = useRogueliteStore()
    const { isLandscape } = useOrientation()
    const navigate = useNavigate()

    /** 回合列表容器：只有玩家本来就贴在底部时，新内容才自动滚到底（翻看历史时不动） */
    const roundsRef = useRef<HTMLDivElement>(null)
    const atBottomRef = useRef(true)
    const roundsCount = `${gameState?.history.length ?? 0}:${gameState?.rounds.length ?? 0}`
    useEffect(() => {
        const el = roundsRef.current
        if (el && atBottomRef.current) el.scrollTop = el.scrollHeight
    }, [roundsCount])
    const handleRoundsScroll = () => {
        const el = roundsRef.current
        if (!el) return
        atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= 8
    }

    function handleExit() {
        reset()
        navigate('/')
    }

    if (!gameState) return null

    // 开场背景页（选故事线之前）
    if (!worldIntroShown) {
        return <IntroOverlay kicker="公元 2088 年" title="青山镇" text={WORLD_INTRO} onEnter={confirmWorldIntro} />
    }

    // 真结局：先单独放一页终章（新会长从炁印里知道的来龙去脉），读完才进结算
    if (gameState.finished && gameState.flags['ending_true'] && !endingSeen) {
        return (
            <IntroOverlay
                kicker={TRUE_ENDING_EPILOGUE.kicker}
                title={TRUE_ENDING_EPILOGUE.title}
                text={TRUE_ENDING_EPILOGUE.text}
                enterLabel="结束"
                onEnter={confirmEnding}
            />
        )
    }

    if (gameState.finished) {
        const finishTitle = gameState.flags['ending_true']
            ? ENDING_NAMES.true
            : gameState.flags['ending_fallen']
              ? ENDING_NAME_FALLEN
              : gameState.flags['ending_loop']
                ? ENDING_NAMES.loop
                : ENDING_NAME_DEFAULT
        return (
            <div className="rs rs-finish">
                <h1>{finishTitle}</h1>
                <p>伤势: {gameState.injury}</p>
                <p>获得: {gameState.build.rewards.length} 个奖励</p>
                <button className="rs-btn" onClick={reset}>
                    再来一局
                </button>
                <button className="rs-btn" onClick={() => navigate('/')}>
                    返回主菜单
                </button>
            </div>
        )
    }

    // 章节页：按章节盖在正文上方，读完进入
    const ci = chapterIntro
    const chapterOverlay =
        ci && (() => {
            const meta = CHAPTERS.find((c) => c.chapter === ci.chapter)
            // 第一章在选故事线之前播放 → 用公共正文；第二/三章按故事线
            const text = ci.chapter === 1 ? CHAPTER1_INTRO : (STORY_INTRO_TEXT[ci.story]?.[ci.chapter] ?? '')
            return (
                <IntroOverlay
                    kicker={`第${CHAPTER_CN[ci.chapter]}章`}
                    title={meta?.title}
                    text={text}
                    onEnter={confirmChapterIntro}
                />
            )
        })()

    // 当前战斗/教学轮：嵌 BattlePanel 播本场回放（引擎已结算那局，结果与动画一致）
    const renderRound = (r: Round, i: number): ReactElement => {
        const isCurrent = i === gameState.rounds.length - 1
        const isCombat = !!r.enemyId || !!r.enemyPool || !!r.enemyBuild
        const isTutorial = !!r.tutorial
        if (isCurrent && (isCombat || isTutorial)) {
            const replay = engine.getBattleReplay(r.id)
            if (replay) {
                let aBuild: CharacterBuild = gameState.build
                let bBuild: CharacterBuild = gameState.build
                let aName: string = aBuild.name
                let bName: string = bBuild.name
                if (isTutorial && r.tutorial) {
                    const aDef = getOpponentDef(r.tutorial.aId)
                    const bDef = getOpponentDef(r.tutorial.bId)
                    if (aDef) aBuild = gen(aDef, r.tutorial.level ?? 33)
                    if (bDef) bBuild = gen(bDef, r.tutorial.level ?? 33)
                    aName = r.tutorial.aName ?? aDef?.name ?? aBuild.name
                    bName = r.tutorial.bName ?? bDef?.name ?? bBuild.name
                } else if (r.enemyBuild) {
                    // 隐藏boss（上一轮通关的玩家 build）：属性/招式取存档，显示名仍用剧情名
                    bBuild = r.enemyBuild
                    bName = r.bossName ?? bBuild.name
                } else if (r.enemyId) {
                    const def = getOpponentDef(r.enemyId)
                    if (def) bBuild = gen(def, gameState.nodeIndex)
                    bName = r.bossName ?? bBuild.name
                }
                const data = buildBattleDataFromEntries(
                    replay,
                    { id: aBuild.id, name: aName },
                    { id: bBuild.id, name: bName },
                )
                const tutorialOpen = isTutorial && !!openTutorials[r.id]
                return (
                    <div className="rs-battle" key={`${r.id}-b`}>
                        {r.title && <div className="rs-battle-title">{r.title}</div>}
                        {isTutorial && (
                            <div className="rs-tutorial-bar">
                                <span className="rs-tutorial-note">
                                    教学观战：{aName} 对 {bName}（AI 对局演示，不计胜负）
                                </span>
                                <button
                                    className="rs-tutorial-toggle"
                                    onClick={() => setOpenTutorials((prev) => ({ ...prev, [r.id]: !prev[r.id] }))}
                                >
                                    {tutorialOpen ? '收起' : '展开观看'}
                                </button>
                            </div>
                        )}
                        {(!isTutorial || tutorialOpen) && (
                            <BattlePanel
                                key={`${r.id}-${i}`}
                                buildA={aBuild}
                                buildB={bBuild}
                                showSidePanels={false}
                                initialData={data}
                            />
                        )}
                        {!isTutorial && r.result && (
                            <div className={`rs-result ${r.result.won ? 'rs-win' : 'rs-lose'}`}>
                                {r.result.won ? '胜' : '负'}
                                {r.result.injuryGained > 0 ? ` 伤势+${r.result.injuryGained}` : ''}
                            </div>
                        )}
                        {r.choices.length > 0 && (
                            <button className="rs-battle-continue" onClick={() => select(0)}>
                                {r.choices[0].label ?? '继续'}
                            </button>
                        )}
                    </div>
                )
            }
        }
        return <RoundCard key={i} round={r} past={i < gameState.rounds.length - 1} onChoice={select} />
    }

    /** 是否已选定故事线（未选线时右侧不显示人物面板） */
    const hasStory = !!gameState.build.story

    return (
        <div className={`rs ${isLandscape ? 'rs-landscape' : 'rs-portrait'}`}>
            {chapterOverlay}
            <header className="rs-header">
                <NodeMap nodeIndex={gameState.nodeIndex} />
                <InjuryBar injury={gameState.injury} />
                <span className={`rs-points${gameState.unspentPoints > 0 ? '' : ' rs-points-zero'}`}>
                    修炼点 {gameState.unspentPoints}
                </span>
                <span className="rs-title">斗炁大会</span>
                <button className="rs-exit-btn" onClick={handleExit}>
                    退出
                </button>
            </header>
            <div className="rs-body">
                <div className="rs-rounds" ref={roundsRef} onScroll={handleRoundsScroll}>
                    {/* 过去节点的回合：只看得见结果（回放仅当场可放） */}
                    {gameState.history.length > 0 && (
                        <div className="rs-rounds-history">
                            {gameState.history.map((r, i) => (
                                <RoundCard key={`hist-${i}-${r.id}`} round={r} past />
                            ))}
                        </div>
                    )}
                    {gameState.rounds.map((r, i) => renderRound(r, i))}
                </div>
                {mode === 'build' && <div className="rs-overlay" />}
                {/* 未选故事线时不显示人物面板，也不占右侧宽度 */}
                {hasStory && (
                    <div className={`rs-sidebar rs-${mode}`}>
                        {mode === 'view' && (
                            <button className="rs-prep-btn" onClick={() => setMode('build')}>
                                备 战
                            </button>
                        )}
                        <div className="rs-panel-wrapper">
                            <CharacterPanel
                                mode={mode}
                                build={gameState.build}
                                unspentCultPoints={gameState.unspentPoints}
                                onSave={saveBuild}
                                onBack={() => setMode('view')}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
