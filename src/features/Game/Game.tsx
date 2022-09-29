import { Application } from 'application/Application'
import Game from 'application/Game'
import { System } from 'application/System'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import styled from 'styled-components'

const GameWrapper = styled.div``

const GamePanel = () => {
    const { id } = useParams()
    const [gameState, setGameState] = useState<'loading' | 'ready' | 'error'>('loading')
    const [game, setGame] = useState<Game>()

    useEffect(() => {
        if (id) {
            const gameInfo = System.loadRecord(id)

            if (gameInfo) {
                const game = Application.Instance.initGame(gameInfo)
                console.log(game)
                setGame(game)
                setGameState('ready')
                return () => {
                    Application.Instance.endCurrentGame()
                }
            } else {
                setGameState('error')
            }
        } else {
            setGameState('error')
        }
    }, [id])

    if (gameState === 'loading') {
        return <div>Loading...</div>
    }

    if (gameState === 'error') {
        return (
            <div>
                没有找到此角色，回到<Link to="/">首页</Link>
            </div>
        )
    }

    return <GameWrapper>{game?.mainCharacter?.name}</GameWrapper>
}

export default GamePanel
