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

    const onClick = useCallback(() => {}, [])

    return (
        <TestWrapper>
            <ProgressButton value={progress} onClick={run}>
                Progress
            </ProgressButton>
            <Button disabled={true}>Disabled</Button>
            <SwitchButton isOn={on} onClick={onSwitchClick}>
                Switch
            </SwitchButton>
            <Button onClick={onClick}>随机技能</Button>
            {/* {JSON.stringify(skill)} */}
        </TestWrapper>
    )
}

export default Test
