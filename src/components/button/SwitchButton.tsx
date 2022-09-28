import Button, { ButtonProps } from './Button'
import styled from 'styled-components'
import { ACTIVE_COLOR, PRIMARY_COLOR } from 'shared/shared-colors'
import { useCallback, useEffect, useRef, useState } from 'react'

const SwitchButtonStyle: any = styled(Button)`
    background-color: ${(props: any) => (props.isOn ? PRIMARY_COLOR : 'transparent')};
    color: ${(props: any) => (props.isOn ? ACTIVE_COLOR : PRIMARY_COLOR)};
`

const SwitchButton = (props: SwitchButtonProps) => {
    const { isOn = false, onClick } = props

    const [_on, _setOn] = useState(isOn)
    const onInternalRef = useRef(isOn)

    const setOn = useCallback((value: boolean) => {
        if (value !== onInternalRef.current) {
            onInternalRef.current = value
            _setOn(value)
        }
    }, [])

    useEffect(() => {
        setOn(isOn)
    }, [isOn, setOn])

    const _onClick = useCallback(
        (event: any) => {
            console.log(onInternalRef.current)
            setOn(!onInternalRef.current)
            event.isOn = onInternalRef.current
            onClick?.(event)
        },
        [onClick, setOn]
    )

    return <SwitchButtonStyle {...props} isOn={_on} onClick={_onClick} />
}

export interface SwitchButtonProps extends ButtonProps {
    isOn?: boolean
}

export default SwitchButton
