// AccessoriesEngine：佩戴类配饰建议（阈值触发，确定性）
// 伞/雨衣不在此列：那是「带不带」的携带决策，由 UmbrellaEngine 按通勤暴露窗口单独测算，避免两处口径打架

import type { Accessory, AccessoryKind, DemandVector } from '../types'
import type { WeatherContext } from './weather'
import type { PersonProfile } from './person'
import { neutralPrefs, type ResolvedPrefs } from './prefs'

export function accessoriesOf(
  ctx: WeatherContext,
  demand: DemandVector,
  person: PersonProfile,
  prefs: ResolvedPrefs = neutralPrefs(),
): Accessory[] {
  const list: Accessory[] = []
  const push = (kind: AccessoryKind, label: string, reason?: string) =>
    list.push({ kind, label, reasonCode: reason })

  // 围巾/手套（冷）
  if (ctx.dayMinC <= 4 && person.conservativeK >= 0) {
    push('SCARF', '围巾', 'cold')
  }
  if (ctx.dayMinC <= -2) {
    push('GLOVES', '手套', 'frozen')
  }
  // 墨镜/帽子/防晒（UV）
  if (demand.SOLAR > 35) {
    push('SUNGLASSES', '墨镜', 'sun')
    push('HAT', '遮阳帽', 'sun')
  }
  // 防晒霜（UV 更高）
  if (demand.SOLAR > 55) {
    push('SUNSCREEN', '防晒霜', 'sun-high')
  }
  // 备用 T 恤（闷热出汗；易出汗体质在较低透气压下也会需要）
  if (demand.BREATHABILITY > 55) {
    push('SPARE_TEE', '备用贴身衣', 'sweat')
  } else if (prefs.sweat === 'EASY' && demand.BREATHABILITY > 30) {
    push('SPARE_TEE', '备用贴身衣', 'sweat-easy')
  }
  // 暖手宝（严寒）
  if (ctx.dayMinC <= -5) {
    push('HAND_WARMER', '暖手宝', 'frozen')
  }
  // 轻便马甲/袖套（可脱卸）
  if (demand.REMOVABLE > 45 && demand.WARMTH > 20) {
    push('AIRY_VEST', '轻便马甲', 'removable')
  }
  return list
}