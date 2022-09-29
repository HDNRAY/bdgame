import { ChangeEvent, InputHTMLAttributes, useCallback } from 'react'
import styled from 'styled-components'

const InputStyled = styled.input`
    border: none;
    line-height: 1.4em;
    font-size: 1.2em;

    &:focus-visible {
        outline: none;
    }
`

const Input = (props: InputProps) => {
    const { onChange } = props
    const _onChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            onChange?.(event.target.value)
        },
        [onChange]
    )
    return <InputStyled {...props} onChange={_onChange}></InputStyled>
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
    onChange: (v: string) => void
}

export default Input
