import { useParams } from 'react-router-dom'

const Game = () => {
    const { id } = useParams()

    console.log(id)

    return <div>Game</div>
}

export default Game
