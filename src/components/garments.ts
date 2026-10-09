// 图标语义映射：目录条目 → 雪碧图 symbol id，以及 24 件图标的图鉴元数据。
// 状态只换填充不换造型；行底色只表达层角色（设计交付包 §03）。

import type { AccessoryKind, Category, LayerRole } from '@/core/types'

export type IconRole = LayerRole | 'ACCESSORY'

export interface GarmentIconMeta {
  id: string
  name: string
  role: IconRole
  category: Category | 'ACCESSORY'
}

/** 图鉴顺序：从上到下 = 从外到内（洋葱剥开的顺序） */
export const GARMENT_ICONS: GarmentIconMeta[] = [
  { id: 'of-pro-windbreaker', name: '防风夹克', role: 'PROTECTION', category: 'OUTER' },
  { id: 'of-pro-hardshell', name: '硬壳冲锋衣', role: 'PROTECTION', category: 'OUTER' },
  { id: 'of-pro-raincoat', name: '雨衣', role: 'PROTECTION', category: 'OUTER' },
  { id: 'of-pro-sunshirt', name: '防晒衣', role: 'PROTECTION', category: 'OUTER' },
  { id: 'of-pro-coat', name: '大衣', role: 'PROTECTION', category: 'OUTER' },
  { id: 'of-ins-sweater', name: '薄毛衣', role: 'INSULATION', category: 'TOP' },
  { id: 'of-ins-fleece', name: '抓绒', role: 'INSULATION', category: 'TOP' },
  { id: 'of-ins-downvest', name: '羽绒马甲', role: 'INSULATION', category: 'TOP' },
  { id: 'of-ins-puffer', name: '羽绒服', role: 'INSULATION', category: 'TOP' },
  { id: 'of-ins-knitvest', name: '毛背心', role: 'INSULATION', category: 'TOP' },
  { id: 'of-base-long', name: '长袖打底', role: 'BASE', category: 'TOP' },
  { id: 'of-base-tee', name: '短袖T', role: 'BASE', category: 'TOP' },
  { id: 'of-base-vest', name: '背心', role: 'BASE', category: 'TOP' },
  { id: 'of-base-brief', name: '内裤', role: 'BASE', category: 'BOTTOM' },
  { id: 'of-base-pants', name: '长裤', role: 'BASE', category: 'BOTTOM' },
  { id: 'of-base-shorts', name: '短裤', role: 'BASE', category: 'BOTTOM' },
  { id: 'of-acc-scarf', name: '围巾', role: 'ACCESSORY', category: 'ACCESSORY' },
  { id: 'of-acc-glove', name: '手套', role: 'ACCESSORY', category: 'ACCESSORY' },
  { id: 'of-acc-warmer', name: '暖手宝', role: 'ACCESSORY', category: 'ACCESSORY' },
  { id: 'of-acc-glasses', name: '墨镜', role: 'ACCESSORY', category: 'ACCESSORY' },
  { id: 'of-acc-sunhat', name: '遮阳帽', role: 'ACCESSORY', category: 'ACCESSORY' },
  { id: 'of-acc-sunscreen', name: '防晒霜', role: 'ACCESSORY', category: 'ACCESSORY' },
  { id: 'of-acc-lightvest', name: '轻便马甲', role: 'ACCESSORY', category: 'ACCESSORY' },
  { id: 'of-acc-umbrella', name: '伞', role: 'ACCESSORY', category: 'ACCESSORY' },
]

export const MASCOT_ICON = 'of-mascot-onion'
export const UMBRELLA_ICON = 'of-acc-umbrella'
export const RAINCOAT_ICON = 'of-pro-raincoat'

// ---------- 45 件目录条目 → 24 个图形 ----------
// 图形只到"款型"粒度：同款型不同面料共用一个造型，靠名称区分（用户靠形状认衣服）
const ITEM_ICONS: Record<string, string> = {
  // 贴身层 · 上装
  t_tank: 'of-base-vest',
  t_cotton_under: 'of-base-vest',
  t_short: 'of-base-tee',
  t_tee: 'of-base-tee',
  t_sport_tee: 'of-base-tee',
  t_polo: 'of-base-tee',
  t_longsleeve: 'of-base-long',
  t_wool_base: 'of-base-long',
  t_silk_base: 'of-base-long',
  t_thermal_top: 'of-base-long',
  // 贴身层 · 下装
  b_shorts: 'of-base-shorts',
  b_swim_short: 'of-base-shorts',
  b_chinos: 'of-base-pants',
  b_jeans: 'of-base-pants',
  b_leggings: 'of-base-pants',
  b_thermal_leg: 'of-base-pants',
  b_wool_pants: 'of-base-pants',
  b_cargo: 'of-base-pants',
  b_trousers_loose: 'of-base-pants',
  // 保暖层
  i_sweater: 'of-ins-sweater',
  i_cardigan: 'of-ins-sweater',
  i_hoodie: 'of-ins-fleece',
  i_fleece: 'of-ins-fleece',
  i_mid_cotton: 'of-ins-fleece',
  i_down_layer: 'of-ins-puffer',
  i_padded_jacket: 'of-ins-puffer',
  i_bomber: 'of-ins-puffer',
  i_denim_jacket: 'of-ins-knitvest',
  i_blazer: 'of-ins-knitvest',
  i_vest: 'of-ins-knitvest',
  i_quilted_vest: 'of-ins-downvest',
  i_skirt_thick: 'of-base-pants',
  // 防护层
  p_windbreaker: 'of-pro-windbreaker',
  p_softshell: 'of-pro-windbreaker',
  p_vintage: 'of-pro-windbreaker',
  p_hardshell: 'of-pro-hardshell',
  p_swim_jacket: 'of-pro-hardshell',
  p_raincoat: 'of-pro-raincoat',
  p_pvc_poncho: 'of-pro-raincoat',
  p_sun_jacket: 'of-pro-sunshirt',
  p_umbrella_vest: 'of-pro-sunshirt',
  p_linen_jacket: 'of-pro-sunshirt',
  p_down_coat: 'of-pro-coat',
  p_parajumpers: 'of-pro-coat',
  p_trench: 'of-pro-coat',
}

const ACCESSORY_ICONS: Record<AccessoryKind, string> = {
  SCARF: 'of-acc-scarf',
  GLOVES: 'of-acc-glove',
  HAND_WARMER: 'of-acc-warmer',
  SUNGLASSES: 'of-acc-glasses',
  HAT: 'of-acc-sunhat',
  SUNSCREEN: 'of-acc-sunscreen',
  AIRY_VEST: 'of-acc-lightvest',
  SPARE_TEE: 'of-base-tee',
}

/** 目录条目 → symbol id；未知 id 按角色给一个兜底形，绝不让行内出现空洞 */
export function iconForItem(itemId: string, role: LayerRole): string {
  const hit = ITEM_ICONS[itemId]
  if (hit) return hit
  return role === 'PROTECTION'
    ? 'of-pro-windbreaker'
    : role === 'INSULATION'
      ? 'of-ins-sweater'
      : 'of-base-long'
}

export function iconForAccessory(kind: AccessoryKind): string {
  return ACCESSORY_ICONS[kind] ?? 'of-acc-lightvest'
}

/**
 * 渲染尺寸 → 描边宽度（视觉重量一致）
 * 118 大层卡 / 92–96 图鉴与带伞卡 / 60–64 配饰条 / 40 主屏徽章 / 34–38 平板桌面 / 28 小标记
 */
export function strokeWidthFor(size: number): number {
  if (size >= 100) return 3.5
  if (size >= 60) return 3.5
  if (size >= 39) return 4
  if (size >= 30) return 4.5
  return 5
}
