// OutfitScoringEngine：从候选组装一套完整穿搭并评分（确定性）
// 组装 = 在所有槽位组合上做 beam 搜索取整卷最高分；逐槽都没有合格件时登记"被放宽"，不静默冒充合格推荐。

import { COORDINATION, LAYERING, MATCHING, SCORING } from '../config'
import type { ClothingItem, DemandVector, LayerRole, OutfitAssembly } from '../types'
import type { EnsembleNeed, LayerSlot } from './layering'
import { withinComfortFit } from './matching'

export interface AssembledOutfit {
  assembly: OutfitAssembly
  chosen: ClothingItem[]
  score: number
  /** 被放宽的硬约束 code（合格推荐不应出现） */
  relaxedCodes: string[]
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
    paths = pruneToBest(next, demand, need)
  })

  const best = paths[0]
  const assembly = computeAssembly(best.items, best.roles)
  // 槽位产生原因透传到层：界面「这层为什么存在」读的是真实决策依据，不是猜测
  attachSlotReasons(assembly, slots)
  return {
    assembly,
    chosen: best.items,
    score: scoreAssembly(assembly, demand, need),
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
function pruneToBest(paths: SearchPath[], demand: DemandVector, need: EnsembleNeed): SearchPath[] {
  const scored = paths.map((p) => ({
    p,
    s: scoreAssembly(computeAssembly(p.items, p.roles), demand, need),
  }))
  scored.sort((a, b) => b.s - a.s)
  return scored.slice(0, MATCHING.beamWidth).map((x) => x.p)
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

/**
 * 加权评分（权重合计 1.0 + 惩罚）。
 * 保暖贴合以"当前场景需要多少 clo"为目标；欠保暖比略微过暖罚得更重——穿少了会冷，穿多了只是沉。
 * 另罚"上下身失衡"：设计时刻很冷却下装过薄，上面像冬天下面像夏天不叫好组合。
 */
export function scoreAssembly(
  a: OutfitAssembly,
  demand: DemandVector,
  need: EnsembleNeed,
): number {
  const w = SCORING.weights
  const gap = need.requiredClo - a.effectiveClo
  const warmthScore = gap <= 0
    ? 100 - Math.min(SCORING.overWarmMaxPenalty, -gap * SCORING.overWarmPenalty) // 过暖：轻罚
    : 100 - gap * SCORING.underWarmPenalty // 欠暖：重罚
  let score =
    warmthScore * w.warmth +
    a.wind * 100 * w.wind +
    a.water * 100 * w.water +
    a.breathability * 100 * w.breathability +
    (1 - a.weightGrams / 2500) * 100 * w.weight +
    (a.removableCount / 3) * 100 * w.removable +
    a.solar * 100 * w.solar
  // 上下装协调：按设计时刻折算下装应承担的保暖分额，缺多少扣多少
  const bottomClo = a.layers
    .flatMap((l) => l.items)
    .filter((it) => it.category === 'BOTTOM')
    .reduce((sum, it) => sum + it.insulationClo, 0)
  const requiredLegClo = clamp(
    (COORDINATION.legOnsetC - need.designHourTempC) * COORDINATION.legCloPerDegree,
    0,
    COORDINATION.legMaxClo,
  )
  if (bottomClo < requiredLegClo) {
    score -= (requiredLegClo - bottomClo) * COORDINATION.legPenaltyPerClo
  }
  // 惩罚
  if (demand.WIND > 50 && a.wind < 0.5) score -= 25
  if (demand.RAIN > 50 && a.water < 0.5) score -= 30
  if (demand.REMOVABLE > 60 && a.removableCount === 0) score -= 10
  return Math.round(Math.max(0, Math.min(100, score)) * 10) / 10
}
