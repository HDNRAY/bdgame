import Button from 'components/button/Button'
import ProgressButton from 'components/button/ProgressButton'
import SwitchButton from 'components/button/SwitchButton'
import { useCountDown } from 'hooks/hook'
import { useCallback, useState } from 'react'

const Test = () => {
    const { progress, run } = useCountDown({ duration: 2000 })

    const [on, setOn] = useState<boolean>(false)
    const onClick = useCallback((e: any) => {
        setOn(e.isOn)
    }, [])
    return (
        <div>
            {/* {on} */}
            <Button z-type="one-click">One Click</Button>
            <ProgressButton value={progress} onClick={run}>
                Progress
            </ProgressButton>
            <Button disabled={true}>Disabled</Button>
            <SwitchButton isOn={on} onClick={onClick}>
                Switch
            </SwitchButton>
        </div>
    )
}

export default Test
