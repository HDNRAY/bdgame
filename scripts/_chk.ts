import { getBuff } from '../src/data/buffs'
for (const id of ['shao_dao_zi', 'nv_er_hong', 'wan_xiang_jian_yi_buff', 'ciyuan_blade', 'zhu_huo_jue_buff']) {
    console.log(id, '=>', getBuff(id)?.name ?? 'UNDEFINED')
}
