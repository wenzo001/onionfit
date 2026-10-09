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

/** 撤销最后一条反馈（交付包屏 15 的「撤销」）；没有可撤的返回原设置 */
export function revokeLastFeedback(settings: UserSettings): UserSettings {
  const history = settings.feedbackHistory ?? []
  if (!history.length) return settings
  return { ...settings, feedbackHistory: history.slice(0, -1) }
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

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}
