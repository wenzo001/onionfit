// PreferenceEngine：人群之外的偏好解析（风格 / 呈现 / 版型 / 色彩 / 场合 / 暴露习惯 / 出汗 / 反馈）
// 全部软排序维度：缺省值中性（不产生排序信号），不改安全阈值与天气事实；反馈只小步调整、有上限、可撤销。

import { FEEDBACK, EXPOSURE_HABIT, STYLE } from '../config'
import type {
  ClothingItem,
  ColorPreference,
  ExposureHabit,
  FeedbackEntry,
  FeedbackKind,
  Occasion,
  Presentation,
  Silhouette,
  StyleTag,
  SweatLevel,
  UserSettings,
} from '../types'

export interface ResolvedPrefs {
  styles: StyleTag[]
  presentation: Presentation
  silhouette: Silhouette
  colorPreference: ColorPreference
  occasion: Occasion
  exposureHabit: ExposureHabit
  sweat: SweatLevel
  /** 反馈派生：保暖目标偏移 clo（-0.3..0.3，偏冷为正；只调个人舒适目标） */
  warmthBiasClo: number
  /** 反馈派生：透气目标抬升 0..0.3（「闷」） */
  breathBias: number
  /** 反馈派生：正式度权重抬升 0..0.3（「不符合场合」） */
  occasionBias: number
  /** 反馈派生：「很合适」累计放宽的复用容差（分，0..2）；仍必过每槽硬条件 */
  reuseBonus: number
  /** 上一次推荐的实际入选项 id；null = 无历史（多样性/复用不产生信号） */
  previousItemIds: string[] | null
}

/** 缺省设置下的解析结果（引擎内部中性回退，不产生排序信号） */
export function neutralPrefs(): ResolvedPrefs {
  return {
    styles: [],
    presentation: 'UNSPECIFIED',
    silhouette: 'REGULAR',
    colorPreference: 'ANY',
    occasion: 'DAILY',
    exposureHabit: 'SHORT_OUTDOOR',
    sweat: 'AVERAGE',
    warmthBiasClo: 0,
    breathBias: 0,
    occasionBias: 0,
    reuseBonus: 0,
    previousItemIds: null,
  }
}

export function resolvePrefs(settings: UserSettings): ResolvedPrefs {
  const history = settings.feedbackHistory ?? []
  const count = (k: FeedbackKind) => history.filter((e) => e.kind === k).length
  return {
    styles: settings.styles ?? [],
    presentation: settings.presentation ?? 'UNSPECIFIED',
    silhouette: settings.silhouette ?? 'REGULAR',
    colorPreference: settings.colorPreference ?? 'ANY',
    occasion: settings.occasion ?? 'DAILY',
    exposureHabit: settings.exposureHabit ?? 'SHORT_OUTDOOR',
    sweat: settings.sweat ?? 'AVERAGE',
    warmthBiasClo: round2(
      clamp(
        (count('COLD') - count('HOT')) * FEEDBACK.warmthStepClo,
        -FEEDBACK.warmthMaxClo,
        FEEDBACK.warmthMaxClo,
      ),
    ),
    breathBias: round2(Math.min(FEEDBACK.breathMax, count('STUFFY') * FEEDBACK.breathStep)),
    occasionBias: round2(Math.min(FEEDBACK.occasionMax, count('OFF_OCCASION') * FEEDBACK.occasionStep)),
    reuseBonus: Math.min(FEEDBACK.reuseMax, count('JUST_RIGHT') * FEEDBACK.reuseStep),
    previousItemIds: settings.previousItemIds?.length ? settings.previousItemIds : null,
  }
}

/** 暴露习惯 → 防雨需求权重系数（室内压缩但不归零，长时户外放大） */
export function rainExposureFactor(prefs: ResolvedPrefs): number {
  return EXPOSURE_HABIT[prefs.exposureHabit]
}

/** 记录一条反馈（追加式；纯函数，返回新设置） */
export function applyFeedback(settings: UserSettings, kind: FeedbackKind, at: string): UserSettings {
  const history = [...(settings.feedbackHistory ?? []), { kind, at }]
  const trimmed: FeedbackEntry[] = history.slice(-FEEDBACK.maxHistory)
  return { ...settings, feedbackHistory: trimmed }
}

/** 撤销最后一次反馈（交付包屏 15 的「撤销」）；同刻多条（一次点击记两种感受）视为一批一起撤 */
export function revokeLastFeedback(settings: UserSettings): UserSettings {
  const history = settings.feedbackHistory ?? []
  if (!history.length) return settings
  const at = history[history.length - 1].at
  let end = history.length
  while (end > 0 && history[end - 1].at === at) end--
  return { ...settings, feedbackHistory: history.slice(0, end) }
}

/** 本地日期键 YYYY-MM-DD（跨天判定不用 UTC，避免时区把凌晨算成前一天） */
export function dateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 两套 id 是否同一套（不看重顺序） */
export function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const set = new Set(b)
  return a.every((id) => set.has(id))
}

/**
 * 跨天时把「最近展示的一套」抬进 previousItemIds（deck 15「轻微天气变化不换装」的输入）。
 * 同一天不抬 —— 当天多样性分对比的应是昨天那套，而不是自己；无变化返回 null（不写）。
 */
export function rollPreviousItems(settings: UserSettings, planDate: string): UserSettings | null {
  const shown = settings.lastShown
  if (!shown?.ids?.length) return null
  if (shown.date === planDate) return null
  if (sameIds(settings.previousItemIds ?? [], shown.ids)) return null
  return { ...settings, previousItemIds: [...shown.ids] }
}

/** 记录本次展示的整套（输出侧调用）；无变化返回 null（幂等，不会形成写循环） */
export function recordShown(settings: UserSettings, ids: string[], planDate: string): UserSettings | null {
  if (!ids.length) return null
  const shown = settings.lastShown
  if (shown && shown.date === planDate && sameIds(shown.ids, ids)) return null
  return { ...settings, lastShown: { ids: [...ids], date: planDate } }
}

// ---- 标签命中助手（0-1；缺失标签按中性回退，不判负） ----

const credit = (tags: string[] | undefined, ...ok: string[]): number => {
  if (!tags || !tags.length) return STYLE.unmatchedCredit
  return tags.some((t) => ok.includes(t)) ? 1 : STYLE.unmatchedCredit
}

/** 该件的风格是否命中用户的所选风格（多选任一即可） */
export function styleHit(it: ClothingItem, styles: StyleTag[]): boolean {
  return (it.styles ?? []).some((s) => styles.includes(s))
}

/** 正式度（缺省中性日常档） */
export function itemFormality(it: ClothingItem): number {
  return it.formality ?? STYLE.defaultItemFormality
}

/** 正式度与场合目标的贴合 0-1（偏离容差 ∈ config.STYLE） */
export function formalityFit(it: ClothingItem, occasion: Occasion): number {
  const target = STYLE.occasionFormality[occasion] ?? STYLE.occasionFormality.DAILY
  return clamp(1 - Math.abs(itemFormality(it) - target) * STYLE.formalityToleranceScale, 0, 1)
}

/** 色彩与用户偏好的贴合 0-1（中性色对任何偏好都算命中） */
export function colorFit(it: ClothingItem, pref: ColorPreference): number {
  if (pref === 'ANY') return 1
  return credit(it.colors, pref, 'NEUTRAL')
}

/** 廓形与用户偏好的贴合 0-1 */
export function silhouetteFit(it: ClothingItem, pref: Silhouette): number {
  if (pref === 'REGULAR') return 1
  return credit(it.silhouettes, pref)
}

/** 呈现与用户选择的贴合 0-1（unisex 对任何呈现都算命中；不指定 = 全 1） */
export function presentationFit(it: ClothingItem, pref: Presentation): number {
  if (pref === 'UNSPECIFIED') return 1
  return credit(it.presentation, pref, 'UNISEX')
}

/**
 * 呈现准入：带 UNISEX 的件人人可穿；只带单一呈现标签的件（如厚裙）须显式选中该呈现才进候选池。
 * 「不指定」不等于「随便穿」—— 性别专属款要用户自己说要（与软打分无关，这是进池条件）。
 */
export function presentationAdmissible(it: ClothingItem, pref: Presentation): boolean {
  const tags = it.presentation
  if (!tags?.length) return true
  if (tags.includes('UNISEX')) return true
  if (pref === 'MASCULINE' || pref === 'FEMININE') return tags.includes(pref)
  return false
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}
