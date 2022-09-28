import styled from 'styled-components'

export const FlexCenterWrapper = styled.div`
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
    flex-direction: ${({ direction = 'row' }: { direction?: 'column' | 'row' }) => direction};
`
