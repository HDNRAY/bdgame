import { CharacterFactory } from 'application/factories/CharacterFactory'
import { System } from 'application/System'
import Button from 'components/button/Button'
import Input from 'components/input/Input'
import { nanoid } from 'nanoid'
import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FlexCenterWrapper } from 'shared/simple-styled-components'

const CharacterCreation = () => {
    const nav = useNavigate()
    const [name, setName] = useState('')

    const onClick = useCallback(() => {
        const ci = CharacterFactory.createPlayerCharacter({
            name,
        })
        const gameId = nanoid()
        System.saveRecord(gameId, {
            mainCharacter: ci,
            skills: [],
        })
        nav(`/game/${gameId}`)
    }, [name, nav])
    return (
        <FlexCenterWrapper>
            <Input onChange={setName} />
            <Button onClick={onClick}>确定</Button>
        </FlexCenterWrapper>
    )
}

export default CharacterCreation
