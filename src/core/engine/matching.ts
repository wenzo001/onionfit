// ClothingMatchingEngine：为每个槽位从目录挑候选衣物（确定性排序）
// 候选 = 拟合分前若干 + 最厚的合格件：贴合排序天然偏好"差值最小"，厚度取舍交给联合评分。
// 反季件在准入层被挡掉（外壳槽豁免：防雨防风是安全属性）。

import { CATALOG } from '../catalog'
import { COMFORT_FIT, DEMAND, LAYERING, MATCHING, STYLE } from '../config'
import type { ClothingItem, DemandVector, LayerRole } from '../types'
import type { EnsembleNeed, LayerSlot } from './layering'
import {
  colorFit,
  neutralPrefs,
  presentationFit,
  silhouetteFit,
  styleHit,
  type ResolvedPrefs,
} from './prefs'

/** 匹配候选：base 槽位考虑上下装搭配；显式偏好只加软加分（默认设置不改变池序） */
export function matchCandidates(
  demand: DemandVector,
  slots: LayerSlot[],
  need: EnsembleNeed,
  prefs: ResolvedPrefs = neutralPrefs(),
): ClothingItem[][] {
  return slots.map((slot) => pickForSlot(slot, demand, need, prefs))
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

/**
 * 反季准入：设计时刻离这件衣服的舒适窗太远 → 季节不对，不是"差一点"。
 * 外壳槽豁免：雨/风装备在盛夏深冬都要可达。
 */
export function withinComfortFit(it: ClothingItem, slot: LayerSlot, need: EnsembleNeed): boolean {
  if (slot.role === 'PROTECTION') return true
  const [lowC, highC] = it.comfortRangeC
  return (
    need.designHourTempC >= lowC - COMFORT_FIT.coldTolC &&
    need.designHourTempC <= highC + COMFORT_FIT.warmTolC
  )
}

/** 过得了槽位硬过滤的候选（评分之前的一层准入） */
function eligibleFor(slot: LayerSlot, need: EnsembleNeed): ClothingItem[] {
  return poolForSlot(slot).filter((it) => {
    if (it.insulationClo < slot.minClo) return false
    if (slot.needWater && it.water < 0.85) return false
    if (slot.needWind && it.wind < 0.6) return false
    if (slot.needSolar && it.solar < 0.8) return false
    if (!withinComfortFit(it, slot, need)) return false
    return true
  })
}

/**
 * 这套槽位结构下，衣物库最多能凑到多少保暖（贪心取每槽最厚的一件，不重复用件）。
 * 覆盖判定要用它区分「这套偏薄」与「库里根本没有」，两者对用户的说法完全不同。
 * 返回与槽位配对的件和角色：空槽被跳过后角色不得错位。
 */
export function capacityCandidates(
  slots: LayerSlot[],
  need: EnsembleNeed,
): { item: ClothingItem; role: LayerRole }[] {
  const used = new Set<string>()
  const chosen: { item: ClothingItem; role: LayerRole }[] = []
  for (const slot of slots) {
    const pool = eligibleFor(slot, need).filter((it) => !used.has(it.id))
    if (!pool.length) continue
    const best = pool.reduce((a, b) => (b.insulationClo > a.insulationClo ? b : a))
    chosen.push({ item: best, role: slot.role })
    used.add(best.id)
  }
  return chosen
}

/** 设计时刻离舒适窗的距离（0 = 窗内） */
function comfortDistance(it: ClothingItem, tempC: number): number {
  const [lowC, highC] = it.comfortRangeC
  if (tempC < lowC) return lowC - tempC
  if (tempC > highC) return tempC - highC
  return 0
}

/** 为单槽位挑选候选衣物（确定性） */
function pickForSlot(
  slot: LayerSlot,
  demand: DemandVector,
  need: EnsembleNeed,
  prefs: ResolvedPrefs,
): ClothingItem[] {
  const eligible = eligibleFor(slot, need)
  // 合格池为空：退回角色 + 品类原始池做"尽力而为"，按离设计时刻最近排序，
  // 让极寒场景兜底的是最接近的一件（发热保暖裤），而不是拟合分恰好高的短打或裙装
  const picked = eligible.length
    ? eligible
        .map((it) => ({ it, score: fitScore(it, slot, demand, need, prefs) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, MATCHING.poolPerSlot)
        .map((r) => r.it)
    : [...poolForSlot(slot)]
        .sort(
          (a, b) =>
            comfortDistance(a, need.designHourTempC) - comfortDistance(b, need.designHourTempC) ||
            fitScore(b, slot, demand, need, prefs) - fitScore(a, slot, demand, need, prefs),
        )
        .slice(0, MATCHING.poolPerSlot)
  // 贴合排序会把厚件筛到后面；联合评分需要"用厚度补缺口"这个选项在桌上
  const thickest = [...eligible]
    .sort((a, b) => b.insulationClo - a.insulationClo)
    .slice(0, MATCHING.thickRescuePerSlot)
  for (const it of thickest) if (!picked.includes(it)) picked.push(it)
  return picked
}

/** 显式偏好的池内软加分：让风格/呈现/廓形/色彩的合适件进得了前 poolPerSlot 池 */
function poolBonus(it: ClothingItem, prefs: ResolvedPrefs): number {
  let bonus = 0
  if (prefs.styles.length && styleHit(it, prefs.styles)) bonus += STYLE.poolBonus.style
  if (prefs.presentation !== 'UNSPECIFIED' && presentationFit(it, prefs.presentation) === 1) {
    bonus += STYLE.poolBonus.presentation
  }
  if (prefs.silhouette !== 'REGULAR' && silhouetteFit(it, prefs.silhouette) === 1) {
    bonus += STYLE.poolBonus.silhouette
  }
  if (prefs.colorPreference !== 'ANY' && colorFit(it, prefs.colorPreference) === 1) {
    bonus += STYLE.poolBonus.color
  }
  return bonus
}

/** 拟合评分：clo 接近槽位目标最佳、重量轻、透气匹配、可脱卸加分 */
function fitScore(
  it: ClothingItem,
  slot: LayerSlot,
  demand: DemandVector,
  need: EnsembleNeed,
  prefs: ResolvedPrefs,
): number {
  // 保暖刻度用未封顶的缺口：0.55 clo 起有份额，到 baseTargetScaleClo 取满
  const warmthRatio = Math.min(1, Math.max(0, need.requiredClo / DEMAND.baseTargetScaleClo))
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
  score += poolBonus(it, prefs)
  return Math.round(score * 10) / 10
}
