import Button from 'components/button/Button'
import { FlexCenterWrapper } from 'shared/simple-styled-components'
import styled from 'styled-components'
import { useNavigate } from 'react-router-dom'

const IndexGameTitle = styled.div`
    position: absolute;
    top: 14vh;
    font-size: 8rem;
`

const IndexMenu = styled(FlexCenterWrapper)`
    flex-direction: column;
    gap: 10px;
    width: 10vw;
    height: 10vh;
    bottom: 10vh;
`

const Index = () => {
    const navigate = useNavigate()
    const menus = [
        {
            name: '新的冒险',
            path: 'create',
        },
        {
            name: '旧的回忆',
            path: 'load',
        },
    ]
    return (
        <FlexCenterWrapper>
            <IndexGameTitle>BD GAME</IndexGameTitle>
            <IndexMenu>
                {menus.map((menu) => {
                    const { name, path } = menu
                    return (
                        <Button key={name} onClick={() => navigate(path)}>
                            {name}
                        </Button>
                    )
                })}
            </IndexMenu>
        </FlexCenterWrapper>
    )
}

export default Index
