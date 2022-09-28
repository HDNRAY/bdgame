import { ButtonHTMLAttributes } from 'react'
import { DISABLED_COLOR, PRIMARY_COLOR } from 'shared/shared-colors'
import styled from 'styled-components'

const ButtonStyle = styled.button`
    border: 1px solid ${PRIMARY_COLOR};
    background: transparent;
    color: ${PRIMARY_COLOR};
    line-height: 1.5;
    font-weight: 500;
    padding: 2px 10px;

    &:hover {
        text-decoration: underline;
    }

    &:active {
        background: #bbb;
        color: #222;
    }

    &:disabled {
        border-color: ${DISABLED_COLOR};
        color: ${DISABLED_COLOR};
        text-decoration: none;
        pointer-events: none;
        cursor: disabled;

        &:active {
            background: transparent;
            color: ${DISABLED_COLOR};
        }
    }
`

const Button = (props: ButtonProps) => {
    return <ButtonStyle {...props} />
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {}

export default Button
