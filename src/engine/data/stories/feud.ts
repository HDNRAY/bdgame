import type { StoryDef } from '../../entities/story'

export const FEUD: StoryDef = {
    id: 'feud',
    name: '血海深仇',
    characterName: '遗孤',
    description:
        '幼年家族被隐藏boss的组织灭门，会长（父亲挚友）恰好救了你，从此在青山镇长大。你父亲曾在军中服役，与铁剑·红提是同袍。',
    overrides: {
        2: 'feud_n02_weapon',
        3: 'feud_n03_action',
        22: 'boss_ajiu',
    },
    insertions: [{ eventId: 'feud_luhongti_spar', range: [12, 21] }],
}
