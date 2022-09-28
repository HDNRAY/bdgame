import Test from 'features/test';
import { PRIMARY_COLOR } from 'shared/shared-colors';
import styled from 'styled-components';

const AppStyled = styled.div`
    width: 100vw;
    height: 100vh;
    overflow-x: hidden;
    overflow-y: auto;
    background-color: #111;
    color: ${PRIMARY_COLOR};
`;
const App = () => {
    return (
        <AppStyled>
            BD Game
            <Test />
        </AppStyled>
    );
};

export default App;
