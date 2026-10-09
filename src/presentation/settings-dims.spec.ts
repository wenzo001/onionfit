// deck 14 设置面板的展示层契约：已改计数逐维可识别、折叠摘要文案、选项与引擎枚举一一对应
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type UserSettings } from '@/core/types'
import { ACTIVITY } from '@/core/config'
import { SELECTABLE_ACTIVITIES } from '@/core/engine/activity'
import {
  COLOR_LABEL,
  COLOR_ORDER,
  HABIT_LABEL,
  HABIT_ORDER,
  HABIT_SUB,
  OCCASION_LABEL,
  OCCASION_ORDER,
  PRESENTATION_LABEL,
  PRESENTATION_ORDER,
  PROFILE_LABEL,
  PROFILE_ORDER,
  SENSITIVITY_LABEL,
  SENSITIVITY_ORDER,
  SILHOUETTE_LABEL,
  SILHOUETTE_ORDER,
  STYLE_LABEL,
  STYLE_ORDER,
  SWEAT_LABEL,
  SWEAT_ORDER,
  settingsChangedCount,
  settingsCountLine,
  styleSummary,
} from '@/presentation'

/** 12 个维度逐条改动（手写清单 = deck 14 编号，不从产品表派生，避免同源自证） */
const ONE_DIM: [string, (s: UserSettings) => UserSettings][] = [
  ['① 人群', (s) => ({ ...s, profile: 'ELDERLY' })],
  ['② 冷热偏好', (s) => ({ ...s, sensitivity: 'COLD_SENSITIVE' })],
  ['③ 易出汗', (s) => ({ ...s, sweat: 'EASY' })],
  ['④ 活动', (s) => ({ ...s, activity: 'CYCLING' })],
  ['⑤ 暴露习惯', (s) => ({ ...s, exposureHabit: 'LONG_OUTDOOR' })],
  ['⑥ 场合', (s) => ({ ...s, occasion: 'OFFICE' })],
  ['⑦ 出门时刻', (s) => ({ ...s, outTime: '08:10' })],
  ['⑧ 回家时刻', (s) => ({ ...s, homeTime: '18:40' })],
  ['⑨ 风格', (s) => ({ ...s, styles: ['SPORT'] })],
  ['⑩ 呈现', (s) => ({ ...s, presentation: 'NEUTRAL' })],
  ['⑪ 版型', (s) => ({ ...s, silhouette: 'LOOSE' })],
  ['⑫ 色彩', (s) => ({ ...s, colorPreference: 'WARM' })],
]

describe('设置计数：已改 N 项 · M 项用默认', () => {
  it('默认设置 = 0 改 / 共 12 维', () => {
    expect(settingsChangedCount({ ...DEFAULT_SETTINGS })).toEqual({ changed: 0, total: 12 })
  })

  it.each(ONE_DIM)('%s 单独改动只计 1 项', (_name, mut) => {
    expect(settingsChangedCount(mut({ ...DEFAULT_SETTINGS }))).toEqual({ changed: 1, total: 12 })
  })

  it('改 3 项 = 已改 3 · 9 项用默认（deck 14 示例）', () => {
    const s: UserSettings = { ...DEFAULT_SETTINGS, activity: 'CYCLING', sweat: 'EASY', outTime: '08:10' }
    expect(settingsCountLine(s)).toBe('已改 3 项 · 9 项用默认')
  })

  it('显式填 07:30 算改过（没填才用默认，不能看起来像设过）', () => {
    const s: UserSettings = { ...DEFAULT_SETTINGS, outTime: '07:30' }
    expect(settingsChangedCount(s).changed).toBe(1)
  })
})

describe('折叠摘要（⑨⑩⑪⑫）', () => {
  it('全默认行：不挑风格 · 不指定 · 常规 · 无偏好', () => {
    expect(styleSummary({ ...DEFAULT_SETTINGS })).toBe('用默认：不挑风格 · 不指定 · 常规 · 无偏好')
  })

  it('改过后给出当前四项的标签', () => {
    const s: UserSettings = {
      ...DEFAULT_SETTINGS,
      styles: ['JAPANESE_LOOSE'],
      presentation: 'NEUTRAL',
      silhouette: 'LOOSE',
      colorPreference: 'COOL',
    }
    expect(styleSummary(s)).toBe('当前：日系宽松 · 中性 · 宽松 · 冷色')
  })

  it('多选风格按选择顺序连接', () => {
    const s: UserSettings = { ...DEFAULT_SETTINGS, styles: ['SPORT', 'STREET'] }
    expect(styleSummary(s)).toBe('当前：运动、街头 · 不指定 · 常规 · 无偏好')
  })
})

describe('选项清单与引擎枚举一一对应（§10.1）', () => {
  const cases: [string, string[], Record<string, string>][] = [
    ['人群', PROFILE_ORDER, PROFILE_LABEL],
    ['冷热偏好', SENSITIVITY_ORDER, SENSITIVITY_LABEL],
    ['易出汗', SWEAT_ORDER, SWEAT_LABEL],
    ['暴露习惯', HABIT_ORDER, HABIT_LABEL],
    ['场合', OCCASION_ORDER, OCCASION_LABEL],
    ['风格', STYLE_ORDER, STYLE_LABEL],
    ['呈现', PRESENTATION_ORDER, PRESENTATION_LABEL],
    ['版型', SILHOUETTE_ORDER, SILHOUETTE_LABEL],
    ['色彩', COLOR_ORDER, COLOR_LABEL],
  ]

  it.each(cases)('%s：顺序表与标签表成员相同且无重复', (_name, order, labels) => {
    expect(order.length).toBe(Object.keys(labels).length)
    expect(new Set(order).size).toBe(order.length)
    expect(new Set(order)).toEqual(new Set(Object.keys(labels)))
  })

  it('活动：界面可选项与引擎枚举一一对应（含「开车」）', () => {
    const values = SELECTABLE_ACTIVITIES.map((a) => a.value)
    expect(new Set(values)).toEqual(new Set(Object.keys(ACTIVITY)))
    expect(values).toContain('DRIVING')
  })

  it('暴露习惯刻度用设计稿口径', () => {
    expect(HABIT_SUB).toEqual({ MAINLY_INDOOR: '< 30 分', SHORT_OUTDOOR: '0.5–2 时', LONG_OUTDOOR: '> 2 时' })
  })
})

describe('标签措辞对齐 deck 14', () => {
  it('关键标签与设计稿逐字一致', () => {
    expect(PROFILE_LABEL.ELDERLY).toBe('老年人')
    expect(SENSITIVITY_LABEL.NORMAL).toBe('中性')
    expect(SWEAT_LABEL.NO).toBe('否')
    expect(HABIT_LABEL.MAINLY_INDOOR).toBe('主要室内')
    expect(OCCASION_LABEL.SCHOOL).toBe('学校')
    expect(OCCASION_LABEL.OUTDOOR_WORK).toBe('户外作业')
    expect(OCCASION_LABEL.FORMAL).toBe('正式活动')
    expect(STYLE_LABEL.BUSINESS).toBe('商务正式')
    expect(STYLE_LABEL.KOREAN_CLEAN).toBe('韩系简洁')
    expect(PRESENTATION_LABEL.UNSPECIFIED).toBe('不指定')
    expect(SILHOUETTE_LABEL.REGULAR).toBe('常规')
    expect(COLOR_LABEL.BRIGHT).toBe('明亮')
  })
})
