import { Application } from 'application/Application'
import Battle from 'application/battle/battle'
import { BattleUnit } from 'application/battle/interfaces'
import Button from 'components/button/Button'
import ProgressButton from 'components/button/ProgressButton'
import SwitchButton from 'components/button/SwitchButton'
import { useCountDown } from 'hooks/hook'
// import Skill from 'application/models/Skill'
import { useCallback, useState } from 'react'
import styled from 'styled-components'

const TestWrapper = styled.div`
    position: fixed;
    bottom: 0;
    left: 0;
`

const Test = () => {
    const { progress, run } = useCountDown({ duration: 2000 })

    const [on, setOn] = useState<boolean>(false)
    const onSwitchClick = useCallback((e: any) => {
        setOn(e.isOn)
    }, [])

    // const [skill, setSkill] = useState<Skill>()

    const onClick = useCallback(() => {
        const characters: Array<BattleUnit> = [
            {
                name: 'Ray',
                team: 0,
                type: 'character',
                staticAttributes: {
                    volumne: {
                        health: 100,
                        mana: 100,
                    },
                    base: {
                        strength: 10,
                    },
                },
                skill: Application.Instance.skillsMap['1'],
            },
            {
                name: '61f',
                type: 'character',
                team: 1,
                staticAttributes: {
                    volumne: {
                        health: 80,
                        mana: 100,
                    },
                    base: {
                        strength: 15,
                    },
                },
                skill: Application.Instance.skillsMap['1'],
            },
        ]
        const state = Battle.create(characters)
        Battle.compute(state)
    }, [])

    return (
        <TestWrapper>
            <ProgressButton value={progress} onClick={run}>
                Progress
            </ProgressButton>
            <Button disabled={true}>Disabled</Button>
            <SwitchButton isOn={on} onClick={onSwitchClick}>
                Switch
            </SwitchButton>
            <Button onClick={onClick}>战斗</Button>
            {/* {JSON.stringify(skill)} */}
        </TestWrapper>
    )
}

export default Test
