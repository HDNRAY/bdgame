import type { ReactElement } from 'react'
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
import { WORLD_INTRO, CHAPTERS, STORY_INTRO_TEXT } from '../../../data/story-intros'
import './RogueliteScreen.scss'

const CHAPTER_CN = ['', '一', '二', '三']

export function RogueliteScreen() {
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
        confirmWorldIntro,
        confirmChapterIntro,
    } = useRogueliteStore()
    const { isLandscape } = useOrientation()
    const navigate = useNavigate()

    function handleExit() {
        reset()
        navigate('/')
    }

    if (!gameState) return null

    // 开场背景页（选故事线之前）
    if (!worldIntroShown) {
        return <IntroOverlay kicker="公元 2088 年" title="青山镇" text={WORLD_INTRO} onEnter={confirmWorldIntro} />
    }

    if (gameState.finished) {
        return (
            <div className="rs rs-finish">
                <h1>通关</h1>
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
            const text = STORY_INTRO_TEXT[ci.story]?.[ci.chapter] ?? ''
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
        const isCombat = !!r.enemyId || !!r.enemyPool
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
                } else if (r.enemyId) {
                    const def = getOpponentDef(r.enemyId)
                    if (def) bBuild = gen(def, gameState.nodeIndex)
                    bName = r.bossName ?? bBuild.name
                }
                const data = buildBattleDataFromEntries(replay, aName, bName)
                return (
                    <div className="rs-battle" key={`${r.id}-b`}>
                        {r.title && <div className="rs-battle-title">{r.title}</div>}
                        <BattlePanel
                            key={`${r.id}-${i}`}
                            buildA={aBuild}
                            buildB={bBuild}
                            showSidePanels={false}
                            initialData={data}
                        />
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
                <div className="rs-rounds">
                    {gameState.rounds.map((r, i) => renderRound(r, i))}
                </div>
                {mode === 'build' && <div className="rs-overlay" />}
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
            </div>
        </div>
    )
}
