import Button, { ButtonProps } from './Button'
import styled from 'styled-components'
import { ACTIVE_COLOR, PRIMARY_COLOR } from 'shared/shared-colors'

const ProgressButtonStyle: any = styled(Button)`
    background-image: ${(props: any) =>
        `linear-gradient(90deg, #eee, #eee ${props.progress}%,transparent ${props.progress}%) !important`};
    color: ${(props: any) => (props.progress > 0 ? ACTIVE_COLOR : PRIMARY_COLOR)};
`

const ProgressButton = (props: ProgressButtonProps) => {
    const { value = 50, max = 100 } = props
    const progress = (value * 100) / max
    return <ProgressButtonStyle disabled={props.disabled || value > 0} progress={progress} {...props} />
}

export interface ProgressButtonProps extends ButtonProps {
    value?: number
    max?: number
}

export default ProgressButton
