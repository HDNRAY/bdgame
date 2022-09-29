import { CharacterInfo } from 'application/models/Character'

export interface CharacterPanelProps {
    character?: CharacterInfo
}
const CharacterPanel = (props: CharacterPanelProps) => {
    const { character } = props
    return <div>{character?.name}</div>
}

export default CharacterPanel
