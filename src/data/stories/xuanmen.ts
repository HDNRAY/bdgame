import type { StoryDef } from '../../game/entities/story'

export const XUANMEN: StoryDef = {
    id: 'xuanmen',
    name: '玄门子弟',
    characterName: '玄十 → 玄久',
    description:
        '玄门，青山镇最古老的宗门之一，血脉中拥有以炁御物的能力。你有一个双胞胎姐姐，而玄门有一条历代传下的规矩——双胞胎，只能留一个。',
    overrides: {
        1: 'origin_xuanmen',
        2: 'xuanmen_n02_weapon',
        3: 'xuanmen_n03_start',
        9: 'xuanmen_n09_secret',
        11: 'boss_junshi',
        15: 'xuanmen_n15_heishu',
        16: 'xuanmen_n16_confront',
    },
    insertions: [
        { eventId: 'douqi_library', range: [24, 24] },
        { eventId: 'memory_within_memory', range: [4, 8] },
    ],
    reward: { type: 'points', id: '' },
}
