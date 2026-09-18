// 换武/缴械不再需要逆运算 helper：
//   revertWeaponStatBuffs —— 手写扣回旧武器 stat_buff，账里仍是旧武器（重算会把换武回滚）
//   clearWeaponBuffLayers —— 直接 delete + 手写扣属性，重算会把请求值再加回来
// 现在统一走 Character.setWeapon()（撤来源层 + 挂新来源层 + 物化自带 buff）。
