// OutfitScoringEngine：从候选组装一套完整穿搭并评分（确定性）
// 组合方式：逐层取第一名（如果第一适合温度窗口），否则走第二

import type { ClothingItem, DemandVector, OutfitAssembly } from '../types'
import { LAYERING, SCORING } from '../config'
import type { LayerSlot } from './layering'

export interface AssembledOutfit {
  assembly: OutfitAssembly
  chosen: ClothingItem[]
  score: number
  /** 被放宽的硬约束 code */
  relaxedCodes: string[]
}

/** 依据槽位与候选，组装一套穿搭 */
export function assembleOutfit(
  slots: LayerSlot[],
  candidates: ClothingItem[][],
  demand: DemandVector,
): AssembledOutfit {
  const chosen: ClothingItem[] = []
  const used = new Set<string>()

  slots.forEach((slot, i) => {
    const pool = candidates[i] ?? []
    // 主选：评分最高的；若槽位有温度/属性硬约束且第一名不满足，尝试第二名
    let pick: ClothingItem | undefined
    for (const it of pool) {
      if (used.has(it.id)) continue // 双保暖槽不得选同一件
      if (slotHardSatisfied(it, slot)) {
        pick = it
        break
      }
    }
    if (!pick && pool.length) {
      pick = pool.find((it) => !used.has(it.id)) ?? pool[0]
    }
    if (pick) {
      chosen.push(pick)
      used.add(pick.id)
    }
  })

  const assembly = computeAssembly(chosen)
  // 槽位产生原因透传到层：界面「这层为什么存在」读的是真实决策依据，不是猜测
  attachSlotReasons(assembly, slots)
  const score = scoreAssembly(assembly, demand)
  return { assembly, chosen, score, relaxedCodes: [] }
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

/** 槽位硬属性检查（拉伸到候选挑选） */
function slotHardSatisfied(it: ClothingItem, slot: LayerSlot): boolean {
  if (slot.needWater && it.water < 0.9) return false
  if (slot.needWind && it.wind < 0.7) return false
  if (slot.needSolar && it.solar < 0.8) return false
  if (it.insulationClo < slot.minClo) return false
  return true
}

/** 组装单一穿搭结构 */
export function computeAssembly(chosen: ClothingItem[]): OutfitAssembly {
  // 层间 clo 递减：同一身叠穿才打折（两件保暖层），上装+下装是并排覆盖、直接相加
  const roleCount: Record<string, number> = {}
  let totalNominal = 0
  chosen.forEach((it) => {
    const k = roleCount[it.role] ?? 0
    roleCount[it.role] = k + 1
    totalNominal += it.insulationClo * Math.pow(LAYERING.layerDiminish, k)
  })
  // 风穿透折损：外层风挡不足时有效 clo 下降
  const protection = chosen.find((it) => it.role === 'PROTECTION')
  const windFactor = protection && protection.wind >= 0.8 ? 1 : 0.85
  const effectiveClo = totalNominal * windFactor

  const groups: Record<string, ClothingItem[]> = { BASE: [], INSULATION: [], PROTECTION: [] }
  chosen.forEach((it) => groups[it.role]?.push(it))

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

/** 加权评分（8 项权重合计 1.0 + 惩罚） */
export function scoreAssembly(a: OutfitAssembly, demand: DemandVector): number {
  const w = SCORING.weights
  // 保暖贴合：有效 clo 与需求差值
  const warmthScore = 100 - Math.min(100, Math.abs(a.effectiveClo - 1.0) * 40)
  let score =
    warmthScore * w.warmth +
    a.wind * 100 * w.wind +
    a.water * 100 * w.water +
    a.breathability * 100 * w.breathability +
    (1 - a.weightGrams / 2500) * 100 * w.weight +
    (a.removableCount / 3) * 100 * w.removable +
    a.solar * 100 * w.solar
  // 惩罚
  if (demand.WIND > 50 && a.wind < 0.5) score -= 25
  if (demand.RAIN > 50 && a.water < 0.5) score -= 30
  if (demand.REMOVABLE > 60 && a.removableCount === 0) score -= 10
  return Math.round(Math.max(0, Math.min(100, score)) * 10) / 10
}