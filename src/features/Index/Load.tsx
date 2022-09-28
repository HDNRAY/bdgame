import Button from 'components/button/Button'
import { useCallback, useEffect, useState } from 'react'
import { FlexCenterWrapper } from 'shared/simple-styled-components'
import { useNavigate } from 'react-router-dom'
import { System } from 'application/System'
import styled from 'styled-components'

const BackArrow = styled.div`
    position: absolute;
    top: 10vh;
    left: 10vw;
    cursor: pointer;
`

const Load = () => {
    const navigate = useNavigate()

    const onMenuClick = useCallback(
        (id: string) => {
            navigate(`/game/${id}`)
        },
        [navigate]
    )

    const [items, setItems] = useState<Array<any> | undefined>()

    useEffect(() => {
        const gameList = System.loadRecordList()
        setItems(gameList)
    }, [])

    return (
        <FlexCenterWrapper direction="column">
            <BackArrow onClick={() => navigate(-1)}>&lt;</BackArrow>
            {items?.map((item) => {
                const { name, id } = item
                return (
                    <Button key={name} onClick={() => onMenuClick(id)}>
                        {name}
                    </Button>
                )
            })}
        </FlexCenterWrapper>
    )
}

export default Load
