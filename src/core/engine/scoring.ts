// OutfitScoringEngine：从候选组装一套完整穿搭并评分（确定性）
// 组装 = beam 搜索取整卷最高分 + 搜后单件替换精修，再在分数接近时优先复用上一次组合；
// 逐槽都没有合格件时登记"被放宽"，不静默冒充合格推荐。
// 评分按方案 §7.3 的分项满分制（合计 100，含多样性 3 分）。
// 默认偏好下风格/偏好/多样性分项取中性常数，不产生排序信号（与既有行为向后兼容）。

import { CATALOG } from '../catalog'
import { COORDINATION, LAYERING, MATCHING, SCORING, STABILITY, STYLE } from '../config'
import type { ClothingItem, DemandVector, LayerRole, OutfitAssembly, ScoreBucket } from '../types'
import type { EnsembleNeed, LayerSlot } from './layering'
import { poolForSlot, withinComfortFit } from './matching'
import {
  colorFit,
  formalityFit,
  neutralPrefs,
  presentationFit,
  silhouetteFit,
  styleHit,
  type ResolvedPrefs,
} from './prefs'

export interface AssembledOutfit {
  assembly: OutfitAssembly
  chosen: ClothingItem[]
  score: number
  /** dayScore 的分项构成（方案 §7.3，UI 分数卡消费） */
  breakdown: ScoreBucket[]
  /** 被放宽的硬约束 code（合格推荐不应出现） */
  relaxedCodes: string[]
}

export interface ScoreDetail {
  total: number
  buckets: ScoreBucket[]
}

/** 搜索路径：逐槽累积的件、角色、已用件与被放宽的约束 */
interface SearchPath {
  items: ClothingItem[]
  roles: LayerRole[]
  used: Set<string>
  relaxed: string[]
}

/**
 * 依据槽位与候选，联合搜索整卷得分最高的一套穿搭。
 * 逐槽贪心"取第一个合格件"会让上身补齐了、下身还在过薄处打转；联合评分把上下装放同一卷里比较。
 */
export function assembleOutfit(
  slots: LayerSlot[],
  candidates: ClothingItem[][],
  demand: DemandVector,
  need: EnsembleNeed,
  prefs: ResolvedPrefs = neutralPrefs(),
): AssembledOutfit {
  let paths: SearchPath[] = [{ items: [], roles: [], used: new Set(), relaxed: [] }]

  slots.forEach((slot, i) => {
    const pool = candidates[i] ?? []
    const next: SearchPath[] = []
    for (const p of paths) {
      const available = pool.filter((it) => !p.used.has(it.id))
      const ok = available.filter((it) => slotHardSatisfied(it, slot, need))
      if (ok.length) {
        for (const it of ok) next.push(extend(p, it, slot.role, []))
      } else if (available.length) {
        // 没有一件满足硬条件：保留"尽力而为"的组合给界面展示，但必须登记未满足项
        next.push(extend(p, available[0], slot.role, [`RELAXED_${slot.role}`]))
      } else {
        next.push({
          ...p,
          used: new Set(p.used),
          relaxed: [...p.relaxed, `NO_CANDIDATE_${slot.role}_${slot.category}`],
        })
      }
    }
    paths = pruneToBest(next, demand, need, prefs)
  })

  const polished = polishPath(paths[0], slots, candidates, demand, need, prefs)
  const best = reuseIfStable(polished, slots, demand, need, prefs) ?? polished
  const assembly = computeAssembly(best.items, best.roles)
  // 槽位产生原因透传到层：界面「这层为什么存在」读的是真实决策依据，不是猜测
  attachSlotReasons(assembly, slots)
  const detail = scoreDetail(assembly, demand, need, prefs)
  return {
    assembly,
    chosen: best.items,
    score: detail.total,
    breakdown: detail.buckets,
    relaxedCodes: best.relaxed,
  }
}

function extend(p: SearchPath, it: ClothingItem, role: LayerRole, relaxed: string[]): SearchPath {
  return {
    items: [...p.items, it],
    roles: [...p.roles, role],
    used: new Set(p.used).add(it.id),
    relaxed: [...p.relaxed, ...relaxed],
  }
}

/** beam 剪枝：按"目前为止整卷得分"保留前 beamWidth 支（稳定排序，保证确定性） */
function pruneToBest(
  paths: SearchPath[],
  demand: DemandVector,
  need: EnsembleNeed,
  prefs: ResolvedPrefs,
): SearchPath[] {
  const scored = paths.map((p) => ({
    p,
    s: scoreAssembly(computeAssembly(p.items, p.roles), demand, need, prefs),
  }))
  scored.sort((a, b) => b.s - a.s)
  return scored.slice(0, MATCHING.beamWidth).map((x) => x.p)
}

/**
 * 搜后精修：beam 按"前缀得分"剪枝，会丢掉"薄前缀 + 后补"的组合——
 * 实测 T6w（14℃±8、10 m/s 风）里单件替换就能从 69 拿回 78.1，整轮精修到 79.9（全枚举 80.1）。
 * 对最终路径逐件换成池内任一合格件做局部搜索，直到一轮无可改进；确定性、有界。
 */
function polishPath(
  start: SearchPath,
  slots: LayerSlot[],
  candidates: ClothingItem[][],
  demand: DemandVector,
  need: EnsembleNeed,
  prefs: ResolvedPrefs,
): SearchPath {
  const rebuildRelaxed = (items: ClothingItem[], base: string[]): string[] => {
    const codes = base.filter((c) => c.startsWith('NO_CANDIDATE_'))
    items.forEach((it, i) => {
      if (slots[i] && !slotHardSatisfied(it, slots[i], need)) codes.push(`RELAXED_${slots[i].role}`)
    })
    return [...new Set(codes)]
  }
  let best = start
  let bestScore = scoreAssembly(computeAssembly(best.items, best.roles), demand, need, prefs)
  for (let pass = 0; pass < MATCHING.polishPasses; pass++) {
    let improved = false
    for (let i = 0; i < best.items.length; i++) {
      const pool = candidates[i] ?? []
      for (const it of pool) {
        if (best.used.has(it.id)) continue
        if (slots[i] && !slotHardSatisfied(it, slots[i], need)) continue
        const items = [...best.items]
        items[i] = it
        const s = scoreAssembly(computeAssembly(items, best.roles), demand, need, prefs)
        if (s > bestScore + 1e-9) {
          bestScore = s
          best = {
            items,
            roles: best.roles,
            used: new Set(items.map((x) => x.id)),
            relaxed: rebuildRelaxed(items, best.relaxed),
          }
          improved = true
        }
      }
    }
    if (!improved) break
  }
  return best
}

/**
 * 稳定性：上一次那套如果今天仍逐槽合格、且得分不比新搜出的差太多，就继续穿（换装惩罚）。
 * 安全侧不妥协：任何一槽没有合格旧件（含防雨/防风/保暖硬条件）就直接放弃复用，走新搜索——
 * 昨天没带壳的搭配在今天的雨天里不合格，自然被拒，安全升级永远优先。
 */
function reuseIfStable(
  best: SearchPath,
  slots: LayerSlot[],
  demand: DemandVector,
  need: EnsembleNeed,
  prefs: ResolvedPrefs,
): SearchPath | null {
  const prevIds = prefs.previousItemIds
  if (!prevIds?.length) return null
  const byId = new Map(CATALOG.map((it) => [it.id, it]))
  const prevItems = prevIds.map((id) => byId.get(id)).filter((it): it is ClothingItem => !!it)
  if (prevItems.length < slots.length) return null
  const poolIds = slots.map((s) => new Set(poolForSlot(s).map((p) => p.id)))
  const used = new Set<string>()
  const items: ClothingItem[] = []
  for (let i = 0; i < slots.length; i++) {
    const it = prevItems.find(
      (x) => !used.has(x.id) && poolIds[i].has(x.id) && slotHardSatisfied(x, slots[i], need),
    )
    if (!it) return null
    used.add(it.id)
    items.push(it)
  }
  const roles = slots.map((s) => s.role)
  const prevScore = scoreAssembly(computeAssembly(items, roles), demand, need, prefs)
  const bestScore = scoreAssembly(computeAssembly(best.items, best.roles), demand, need, prefs)
  if (prevScore < bestScore - STABILITY.reuseMargin) return null
  return { items, roles, used, relaxed: [] }
}

/** 层 → 槽位 reasonCode（同角色多槽取第一个非空；贴身层恒在） */
function attachSlotReasons(assembly: OutfitAssembly, slots: LayerSlot[]): void {
  const byRole = new Map<string, string>()
  for (const slot of slots) {
    if (byRole.has(slot.role)) continue
    const code = slot.reasonCodes[0]
    if (code) byRole.set(slot.role, code)
  }
  assembly.layers.forEach((l) => {
    l.noteCode = byRole.get(l.role) ?? (l.role === 'BASE' ? 'ALWAYS_ON' : undefined)
  })
}

/** 槽位硬属性检查（候选挑选与联合搜索共用同一套判据） */
function slotHardSatisfied(it: ClothingItem, slot: LayerSlot, need: EnsembleNeed): boolean {
  if (slot.needWater && it.water < 0.9) return false
  if (slot.needWind && it.wind < 0.7) return false
  if (slot.needSolar && it.solar < 0.8) return false
  if (it.insulationClo < slot.minClo) return false
  if (!withinComfortFit(it, slot, need)) return false
  return true
}

/**
 * 组装单一穿搭结构。
 * slotRoles 指定每件来自哪个槽位——厚外套填保暖槽时它属于保暖层，而不是按自身品类归到防护层。
 */
export function computeAssembly(chosen: ClothingItem[], slotRoles?: LayerRole[]): OutfitAssembly {
  const roleOf = (it: ClothingItem, i: number): LayerRole => slotRoles?.[i] ?? it.role
  // 层间 clo 递减：同一角色叠穿才打折（第二件起 ×0.85），上装+下装分属两槽也照此口径
  const roleCount: Record<string, number> = {}
  let totalNominal = 0
  chosen.forEach((it, i) => {
    const role = roleOf(it, i)
    const k = roleCount[role] ?? 0
    roleCount[role] = k + 1
    totalNominal += it.insulationClo * Math.pow(LAYERING.layerDiminish, k)
  })
  // 风穿透折损：外层风挡不足时有效 clo 下降
  const protectionIdx = chosen.findIndex((it, i) => roleOf(it, i) === 'PROTECTION')
  const protection = protectionIdx >= 0 ? chosen[protectionIdx] : undefined
  const windFactor = protection && protection.wind >= 0.8 ? 1 : 0.85
  const effectiveClo = totalNominal * windFactor

  const groups: Record<string, ClothingItem[]> = { BASE: [], INSULATION: [], PROTECTION: [] }
  chosen.forEach((it, i) => groups[roleOf(it, i)]?.push(it))

  // 分层与 active 状态：只保留有衣物的层（避免渲染空槽位）
  const layers = (Object.keys(groups) as ClothingItem['role'][]).map((role) => {
    const items = groups[role] ?? []
    return {
      role,
      items,
      noteCode: undefined,
      active: items.length > 0,
    }
  }).filter((l) => l.items.length > 0)

  return {
    layers,
    nominalClo: Math.round(totalNominal * 100) / 100,
    effectiveClo: Math.round(effectiveClo * 100) / 100,
    wind: Math.max(...chosen.map((it) => it.wind), 0),
    water: Math.max(...chosen.map((it) => it.water), 0),
    breathability: Math.min(...chosen.map((it) => it.breathability), 1),
    solar: Math.max(...chosen.map((it) => it.solar), 0),
    weightGrams: chosen.reduce((s, it) => s + it.weightGrams, 0),
    removableCount: chosen.filter((it) => it.removable).length,
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const round1 = (v: number) => Math.round(v * 10) / 10

/**
 * 分项评分（方案 §7.3）：热舒适 25 / 天气防护 20 / 活动舒适 15 / 风格场合 18 /
 * 整套协调 10 / 可脱卸 5 / 用户偏好 4 / 多样性 3。硬过滤与安全判定不读分数，
 * 分数只决定"合格候选里谁排前面"。
 */
export function scoreDetail(
  a: OutfitAssembly,
  demand: DemandVector,
  need: EnsembleNeed,
  prefs: ResolvedPrefs = neutralPrefs(),
): ScoreDetail {
  const items = a.layers.flatMap((l) => l.items)
  const raw: ScoreBucket[] = [
    { key: 'warmth', score: warmthBucket(a, need), max: SCORING.buckets.warmth },
    { key: 'protection', score: protectionBucket(a, demand), max: SCORING.buckets.protection },
    { key: 'activity', score: activityBucket(a, demand, prefs), max: SCORING.buckets.activity },
    { key: 'style', score: styleBucket(items, prefs), max: SCORING.buckets.style },
    { key: 'coordination', score: coordinationBucket(a, need), max: SCORING.buckets.coordination },
    { key: 'removable', score: removableBucket(a), max: SCORING.buckets.removable },
    { key: 'preference', score: preferenceBucket(items, prefs), max: SCORING.buckets.preference },
    { key: 'diversity', score: diversityBucket(items, prefs), max: SCORING.buckets.diversity },
  ]
  const buckets = raw.map((b) => ({ ...b, score: round1(b.score) }))
  const total = clamp(round1(buckets.reduce((s, b) => s + b.score, 0)), 0, 100)
  return { total, buckets }
}

/** 整卷总分（dayScore）：分项之和，0-100。 */
export function scoreAssembly(
  a: OutfitAssembly,
  demand: DemandVector,
  need: EnsembleNeed,
  prefs: ResolvedPrefs = neutralPrefs(),
): number {
  return scoreDetail(a, demand, need, prefs).total
}

/** 热舒适：与当前场景所需 clo 的差距；欠保暖比略微过暖罚得更重 */
function warmthBucket(a: OutfitAssembly, need: EnsembleNeed): number {
  const max = SCORING.buckets.warmth
  const gap = need.requiredClo - a.effectiveClo
  const penalty =
    gap <= 0
      ? Math.min(SCORING.overWarmMaxPenalty, -gap * SCORING.overWarmPenaltyPerClo)
      : gap * SCORING.underWarmPenaltyPerClo
  return clamp(max - penalty, 0, max)
}

/**
 * 天气防护：风/雨/晒各自的属性按需求加权。
 * 只有当天真有该维需求（>0）的维度才带着权重入场——纯风天不该让"最防水的壳"白拿防水分
 * （旧版对零需求维度也给 0.15 基准，纯风天硬壳恒压防风夹克，第五步校准）。
 * 三维全无（无风无雨无晒）→ 中性常数，防护属性不参与排名。
 */
function protectionBucket(a: OutfitAssembly, demand: DemandVector): number {
  const max = SCORING.buckets.protection
  const wWind = demand.WIND > 0 ? demand.WIND / 100 + 0.15 : 0
  const wRain = demand.RAIN > 0 ? demand.RAIN / 100 + 0.15 : 0
  const wSolar = demand.SOLAR > 0 ? demand.SOLAR / 100 + 0.15 : 0
  const wsum = wWind + wRain + wSolar
  if (wsum === 0) return max * STYLE.neutralCredit
  const value = (a.wind * wWind + a.water * wRain + a.solar * wSolar) / wsum
  return clamp(value * max, 0, max)
}

/** 活动舒适：透气（权重随需求与「闷」反馈抬升）+ 轻量 */
function activityBucket(a: OutfitAssembly, demand: DemandVector, prefs: ResolvedPrefs): number {
  const max = SCORING.buckets.activity
  const breathWeight = clamp(0.4 + 0.6 * (demand.BREATHABILITY / 100 + prefs.breathBias), 0, 1)
  const breathAdapt = clamp(a.breathability * breathWeight, 0, 1)
  const weightScore = clamp(1 - a.weightGrams / SCORING.weightBudgetGrams, 0, 1)
  return clamp((breathAdapt * 0.7 + weightScore * 0.3) * max, 0, max)
}

/**
 * 风格与场合：只统计用户显式设置的子信号（风格多选 / 非默认场合），
 * 未设置时不产生排序信号；「不符合场合」反馈把权重推向正式度。
 */
function styleBucket(items: ClothingItem[], prefs: ResolvedPrefs): number {
  const max = SCORING.buckets.style
  const parts: { v: number; w: number }[] = []
  if (prefs.styles.length) {
    parts.push({
      v: avg(items, (it) => (styleHit(it, prefs.styles) ? 1 : STYLE.unmatchedCredit)),
      w: STYLE.styleWeight,
    })
  }
  if (prefs.occasion !== 'DAILY') {
    parts.push({
      v: avg(items, (it) => formalityFit(it, prefs.occasion)),
      w: STYLE.formalityWeight + prefs.occasionBias,
    })
  }
  if (!parts.length) return max * STYLE.neutralCredit
  const wsum = parts.reduce((s, p) => s + p.w, 0)
  const mixed = parts.reduce((s, p) => s + p.v * p.w, 0) / wsum
  return clamp(mixed * max, 0, max)
}

/** 整套协调：上下装保暖平衡（冷天不允许上身冬天下身夏天）+ 配色分散轻罚 */
function coordinationBucket(a: OutfitAssembly, need: EnsembleNeed): number {
  const max = SCORING.buckets.coordination
  const items = a.layers.flatMap((l) => l.items)
  const bottomClo = items
    .filter((it) => it.category === 'BOTTOM')
    .reduce((sum, it) => sum + it.insulationClo, 0)
  const requiredLegClo = clamp(
    (COORDINATION.legOnsetC - need.designHourTempC) * COORDINATION.legCloPerDegree,
    0,
    COORDINATION.legMaxClo,
  )
  let score = max
  if (bottomClo < requiredLegClo) score -= (requiredLegClo - bottomClo) * SCORING.legPenaltyPerClo
  if (colorGroupCount(items) >= SCORING.colorClashGroups) score -= SCORING.colorClashPenalty
  return clamp(score, 0, max)
}

/** 整套里出现的非中性色组数（达到阈值 → 配色分散，轻扣分） */
function colorGroupCount(items: ClothingItem[]): number {
  const groups = new Set<string>()
  for (const it of items) for (const g of it.colors ?? []) if (g !== 'NEUTRAL') groups.add(g)
  return groups.size
}

/** 可脱卸：温差场景需要的可脱件数（removableFullCount 件取满） */
function removableBucket(a: OutfitAssembly): number {
  const max = SCORING.buckets.removable
  return clamp(Math.min(1, a.removableCount / SCORING.removableFullCount) * max, 0, max)
}

/** 用户偏好：配色 / 廓形 / 呈现（只统计显式设置的子项；未设置时不产生排序信号） */
function preferenceBucket(items: ClothingItem[], prefs: ResolvedPrefs): number {
  const max = SCORING.buckets.preference
  const w = STYLE.preferenceWeights
  const parts: { v: number; w: number }[] = []
  if (prefs.colorPreference !== 'ANY') {
    parts.push({ v: avg(items, (it) => colorFit(it, prefs.colorPreference)), w: w.color })
  }
  if (prefs.silhouette !== 'REGULAR') {
    parts.push({ v: avg(items, (it) => silhouetteFit(it, prefs.silhouette)), w: w.silhouette })
  }
  if (prefs.presentation !== 'UNSPECIFIED') {
    parts.push({ v: avg(items, (it) => presentationFit(it, prefs.presentation)), w: w.presentation })
  }
  if (!parts.length) return max * STYLE.neutralCredit
  const wsum = parts.reduce((s, p) => s + p.w, 0)
  const mixed = parts.reduce((s, p) => s + p.v * p.w, 0) / wsum
  return clamp(mixed * max, 0, max)
}

/**
 * 多样性：与上一次实际入选项的重合度（无历史 = 中性满分，老用户没记录不背锅；
 * 全换新件 = 满分，全同 = 0）。与复用规则同读 previousItemIds，两侧口径一致。
 */
function diversityBucket(items: ClothingItem[], prefs: ResolvedPrefs): number {
  const max = SCORING.buckets.diversity
  const prev = prefs.previousItemIds
  if (!prev?.length || !items.length) return max
  const novel = items.filter((it) => !prev.includes(it.id)).length / items.length
  return clamp(novel * max, 0, max)
}

const avg = (items: ClothingItem[], f: (it: ClothingItem) => number): number =>
  items.length ? items.reduce((s, it) => s + f(it), 0) / items.length : STYLE.neutralCredit
