// LayeringEngine：由需求向量 + 未封顶的保暖缺口决定"层结构与槽位"
// BASE 必有；保暖缺口决定 1-2 个 INSULATION；雨/风/晒决定 PROTECTION；严寒即使无风雨也要有外层。

import { LAYERING } from '../config'
import type { DemandVector, LayerRole } from '../types'

export interface LayerSlot {
  role: LayerRole
  /** 槽位品类：上装/下装/外层（候选分池，保证上下装各有推荐） */
  category: 'TOP' | 'BOTTOM' | 'OUTER'
  /** 该槽位的目标 clo 下限（匹配引擎用来过滤） */
  minClo: number
  /** 是否要求防水壳（rain） */
  needWater: boolean
  /** 是否要求防风（wind） */
  needWind: boolean
  /** 是否要求遮阳 */
  needSolar: boolean
  /** 严寒：允许把厚外套（防护层里 clo 足够高的件）当保暖用 */
  acceptsWarmOuterwear: boolean
  /** 槽位产生原因 code（透出给文案） */
  reasonCodes: string[]
}

/** 选衣用的保暖缺口（未封顶 clo），展示维 WARMTH 饱和不影响它 */
export interface WarmthNeed {
  requiredClo: number
}

/** 选衣/协调用的需求：保暖缺口之外再带设计时刻气温（反季过滤与上下装协调都要读它） */
export interface EnsembleNeed extends WarmthNeed {
  designHourTempC: number
}

/** 第一保暖槽的衣物下限：缺口越大，要求单件越厚 */
function firstSlotMinClo(requiredClo: number): number {
  const bands = LAYERING.insulationTierBandClo
  const tiers = LAYERING.insulationMinCloTiers
  for (let i = 0; i < bands.length; i++) if (requiredClo <= bands[i]) return tiers[i]
  return tiers[tiers.length - 1]
}

/**
 * 槽位决策（上下装分池，推荐永远含上衣+下装）：
 * - BASE × 2：上装 + 下装（必有）
 * - 雨或风 > 32 → PROTECTION（防水/防风壳）
 * - 无风雨但保暖缺口 ≥ forcedOuterwearClo → PROTECTION（严寒外层，锁暖 + 挡风）
 * - 无壳且 SOLAR > 40 且保暖需求低 → 遮阳外层
 * - 缺口 ≥ firstInsulationClo → +1 INSULATION；≥ secondInsulationClo → 再 +1
 * - 预算不足时按优先级丢：先丢第二保暖，绝不静默丢外层
 */
export function planLayerSlots(demand: DemandVector, need: WarmthNeed): LayerSlot[] {
  const base: LayerSlot[] = [
    { role: 'BASE', category: 'TOP', minClo: 0.03, needWater: false, needWind: false, needSolar: false, acceptsWarmOuterwear: false, reasonCodes: [] },
    { role: 'BASE', category: 'BOTTOM', minClo: 0.03, needWind: false, needWater: false, needSolar: false, acceptsWarmOuterwear: false, reasonCodes: [] },
  ]

  const shell = coldShellSlot(demand, need)
  const warmOuterwear = need.requiredClo >= LAYERING.warmOuterwearClo

  const insulation: LayerSlot[] = []
  if (need.requiredClo >= LAYERING.firstInsulationClo) {
    insulation.push({
      role: 'INSULATION',
      category: 'TOP',
      minClo: firstSlotMinClo(need.requiredClo),
      needWater: false,
      needWind: false,
      needSolar: false,
      acceptsWarmOuterwear: warmOuterwear,
      reasonCodes: [need.requiredClo >= LAYERING.secondInsulationClo ? 'NEED_TWO_LAYERS' : 'NEED_INSULATION'],
    })
  }
  if (need.requiredClo >= LAYERING.secondInsulationClo) {
    insulation.push({
      role: 'INSULATION',
      category: 'TOP',
      minClo: LAYERING.secondInsulationMinClo,
      needWater: false,
      needWind: false,
      needSolar: false,
      acceptsWarmOuterwear: warmOuterwear,
      reasonCodes: ['NEED_SECOND_INSULATION'],
    })
  }

  // 外层优先占用槽位预算：它同时承担防风雨与严寒锁暖，不能被子保暖层挤掉
  const optional = [shell, ...insulation].filter((s): s is LayerSlot => !!s)
  const room = Math.max(0, LAYERING.maxLayers - base.length)
  return [...base, ...optional.slice(0, room)]
}

/** 防护层槽：防风雨优先，其次严寒强制外层，最后才是遮阳壳 */
function coldShellSlot(demand: DemandVector, need: WarmthNeed): LayerSlot | null {
  const needShell = demand.RAIN > 32 || demand.WIND > 32
  if (needShell) {
    return {
      role: 'PROTECTION',
      category: 'OUTER',
      minClo: 0,
      needWater: demand.RAIN > 32,
      needWind: true,
      needSolar: false,
      acceptsWarmOuterwear: false,
      reasonCodes: [demand.RAIN > demand.WIND ? 'NEED_RAIN_SHELL' : 'NEED_WIND_SHELL'],
    }
  }
  // 极寒静风干燥：厚外套是保暖手段，不能等到大风或下雨才允许出现
  if (need.requiredClo >= LAYERING.forcedOuterwearClo) {
    return {
      role: 'PROTECTION',
      category: 'OUTER',
      minClo: LAYERING.warmOuterwearMinClo,
      needWater: false,
      needWind: false,
      needSolar: false,
      acceptsWarmOuterwear: false,
      reasonCodes: ['NEED_COLD_SHELL'],
    }
  }
  if (demand.SOLAR > 40 && demand.WARMTH < 50) {
    return {
      role: 'PROTECTION',
      category: 'OUTER',
      minClo: 0,
      needWater: false,
      needWind: false,
      needSolar: true,
      acceptsWarmOuterwear: false,
      reasonCodes: ['NEED_SUN_SHELL'],
    }
  }
  return null
}

/** 检查需求是否主要由雨/风驱动（决定文案口径） */
export function isShellDriven(demand: DemandVector): boolean {
  return demand.RAIN > 32 || demand.WIND > 32
}

/** 层的展示标签（presentation 也会用） */
export const ROLE_LABEL: Record<LayerRole, string> = {
  BASE: '贴身层',
  INSULATION: '保暖层',
  PROTECTION: '防护层',
}
