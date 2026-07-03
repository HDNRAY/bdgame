import type { StoryDef } from '../../entities/story'

export const XUANMEN: StoryDef = {
    id: 'xuanmen',
    name: '玄门子弟',
    characterName: '弟子',
    description: '御物世家，以炁御器。你从记事起就开始修炼家传功法。',
    overrides: {
        2: 'xuanmen_n02_weapon',
        3: 'xuanmen_n03_start',
        9: 'xuanmen_n09_secret',
        11: 'boss_junshi',
        15: 'xuanmen_n15_heishu',
        16: 'xuanmen_n16_confront',
    },
    insertions: [],
    reward: { type: 'points', id: '' },
}
