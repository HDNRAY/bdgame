import Test from 'features/test'
import { PRIMARY_COLOR } from 'shared/shared-colors'
import styled from 'styled-components'
import { Routes, Route } from 'react-router-dom'
import Game from 'features/Game/Game'
import Index from 'features/Index/Index'
import Load from 'features/Index/Load'
import CharacterCreation from 'features/Index/CharacterCreation'

const AppStyled = styled.div`
    width: 100vw;
    height: 100vh;
    overflow-x: hidden;
    overflow-y: auto;
    background-color: #111;
    color: ${PRIMARY_COLOR};
`
const App = () => {
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
