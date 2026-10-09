// ClothingMatchingEngine：为每个槽位从目录挑候选衣物（确定性排序）
// 简化而非枚举全部组合：每槽取评分最佳的若干件，再组合成一套（≤480 的裁剪不必要）

import { CATALOG } from '../catalog'
import { DEMAND, LAYERING } from '../config'
import type { ClothingItem, DemandVector } from '../types'
import type { LayerSlot, WarmthNeed } from './layering'

/** 匹配候选：base 槽位考虑上下装搭配 */
export function matchCandidates(
  demand: DemandVector,
  slots: LayerSlot[],
  need: WarmthNeed & { designHourTempC: number },
): ClothingItem[][] {
  return slots.map((slot) => pickForSlot(slot, demand, need))
}

/** 候选池：按角色 + 品类分池；严寒时厚外套也可作为保暖候选 */
function poolForSlot(slot: LayerSlot): ClothingItem[] {
  const pool = CATALOG.filter((it) => it.role === slot.role && it.category === slot.category)
  if (slot.acceptsWarmOuterwear) {
    pool.push(
      ...CATALOG.filter(
        (it) => it.role === 'PROTECTION' && it.insulationClo >= LAYERING.warmOuterwearMinClo,
      ),
    )
  }
  return pool
}

/** 过得了槽位硬过滤的候选（评分之前的一层准入） */
function eligibleFor(slot: LayerSlot): ClothingItem[] {
  return poolForSlot(slot).filter((it) => {
    if (it.insulationClo < slot.minClo) return false
    if (slot.needWater && it.water < 0.85) return false
    if (slot.needWind && it.wind < 0.6) return false
    if (slot.needSolar && it.solar < 0.8) return false
    return true
  })
}

/**
 * 这套槽位结构下，衣物库最多能凑到多少保暖（贪心取每槽最厚的一件，不重复用件）。
 * 覆盖判定要用它区分「这套偏薄」与「库里根本没有」，两者对用户的说法完全不同。
 */
export function capacityCandidates(slots: LayerSlot[]): ClothingItem[] {
  const used = new Set<string>()
  const chosen: ClothingItem[] = []
  for (const slot of slots) {
    const pool = eligibleFor(slot).filter((it) => !used.has(it.id))
    if (!pool.length) continue
    const best = pool.reduce((a, b) => (b.insulationClo > a.insulationClo ? b : a))
    chosen.push(best)
    used.add(best.id)
  }
  return chosen
}

/** 为单槽位挑选候选衣物（确定性，最多 4 件） */
function pickForSlot(
  slot: LayerSlot,
  demand: DemandVector,
  need: WarmthNeed & { designHourTempC: number },
): ClothingItem[] {
  const rated = eligibleFor(slot)
    .map((it) => ({ it, score: fitScore(it, slot, demand, need) }))
    .sort((a, b) => b.score - a.score)
  return rated.slice(0, 4).map((r) => r.it)
}

/** 拟合评分：clo 接近槽位目标最佳、重量轻、透气匹配、可脱卸加分 */
function fitScore(
  it: ClothingItem,
  slot: LayerSlot,
  demand: DemandVector,
  need: WarmthNeed & { designHourTempC: number },
): number {
  // 保暖刻度用未封顶的缺口：0.55 clo 起有份额，到 baseTargetScaleClo 取满
  const warmthRatio = Math.min(1, need.requiredClo / DEMAND.baseTargetScaleClo)
  let score = 0
  if (slot.role === 'INSULATION') {
    // 目标 = 槽位 minClo 上浮一点，接近者得分高
    const target = slot.minClo + 0.1
    score += 30 - Math.min(30, Math.abs(it.insulationClo - target) * 40)
  } else if (slot.role === 'BASE') {
    // 贴身层按冷暖季调权重：热天透气主导（凉爽），冷季 clo 就近主导（保暖）
    const breathFactor = 0.4 + (demand.BREATHABILITY / 100) * 0.6 // 冷季 0.4，热季 1.0
    score += it.breathability * 20 * breathFactor
    // 贴身层只承担全身保暖的小份额（其余由保暖/防护层补）：
    // 上装 0.05→0.35 clo、下装 0.04→0.30 clo 随保暖缺口线性
    const target =
      slot.category === 'BOTTOM' ? 0.04 + warmthRatio * 0.26 : 0.05 + warmthRatio * 0.3
    const match = Math.max(0, 12 - Math.abs(target - it.insulationClo) * 40)
    score += match * (0.6 + warmthRatio) // 冷季最高 1.6 倍
  } else {
    // 防护：防水/防风按需求侧重点
    if (slot.needWater) score += it.water * 30
    if (slot.needWind) score += it.wind * 25
    if (slot.needSolar) score += it.solar * 35
    score += it.breathability * 10
  }
  // 通用项
  score += (1 - it.weightGrams / 1500) * 15 // 轻量化
  if (it.removable) score += demand.REMOVABLE * 0.15 // 可脱卸需求加分
  // 舒适温度窗要盖得住设计时刻，否则这件在该时段本来就不该穿
  const [lowC, highC] = it.comfortRangeC
  if (lowC <= need.designHourTempC + 2 && highC >= need.designHourTempC - 2) score += 5
  return Math.round(score * 10) / 10
}
