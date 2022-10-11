import Test from 'features/test'
import { PRIMARY_COLOR } from 'shared/shared-colors'
import styled from 'styled-components'
import { Routes, Route } from 'react-router-dom'
import Game from 'features/Game/GamePanel'
import Index from 'features/Index/Index'
import Load from 'features/Index/Load'
import CharacterCreation from 'features/Index/CharacterCreation'
import { useEffect, useState } from 'react'
import { Application } from 'application/Application'

const AppStyled = styled.div`
    width: 100vw;
    height: 100vh;
    overflow-x: hidden;
    overflow-y: auto;
    background-color: #282828;
    color: ${PRIMARY_COLOR};
`
const App = () => {
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch('/data/skills.json')
            .then((res) => res.json())
            .then((res) => {
                Application.Instance.skills = res.skills
            })
            .catch(console.error)
            .finally(() => setLoading(false))
    })

    if (loading) {
        return <div>Loading...</div>
    }

    return (
        <AppStyled>
            <Routes>
                <Route index element={<Index />}></Route>
                <Route path="load" element={<Load />}></Route>
                <Route path="create" element={<CharacterCreation />}></Route>
                <Route path="game/:id" element={<Game />}></Route>
            </Routes>
            <Test />
        </AppStyled>
    )
}

export default App
