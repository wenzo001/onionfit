// settings store 回归：12 维设置必须全量到达引擎
// （曾经 settings computed 只透传 5 个字段，风格/场合/暴露习惯被静默剥掉）
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { DEFAULT_SETTINGS } from '@/core/types'
import { useSettingsStore } from './settings'

describe('settings store：12 维全量透传', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('默认设置下 settings 与引擎默认值同键同值', () => {
    const s = useSettingsStore()
    expect(Object.keys(s.settings).sort()).toEqual(Object.keys(DEFAULT_SETTINGS).sort())
    expect(s.settings.styles).toEqual([])
    expect(s.settings.exposureHabit).toBe('SHORT_OUTDOOR')
    expect(s.settings.sweat).toBe('AVERAGE')
  })

  it('set 能改扩展维度，且改完立刻从 settings 读到', () => {
    const s = useSettingsStore()
    s.set('styles', ['JAPANESE_LOOSE'])
    s.set('exposureHabit', 'LONG_OUTDOOR')
    s.set('occasion', 'OFFICE')
    s.set('sweat', 'EASY')
    expect(s.settings.styles).toEqual(['JAPANESE_LOOSE'])
    expect(s.settings.exposureHabit).toBe('LONG_OUTDOOR')
    expect(s.settings.occasion).toBe('OFFICE')
    expect(s.settings.sweat).toBe('EASY')
  })

  it('apply 回填快照设置时不吞扩展维度', () => {
    const s = useSettingsStore()
    s.apply({ ...DEFAULT_SETTINGS, styles: ['SPORT'], sweat: 'EASY', outTime: '08:10' })
    expect(s.settings.styles).toEqual(['SPORT'])
    expect(s.settings.sweat).toBe('EASY')
    expect(s.settings.outTime).toBe('08:10')
  })

  it('时间空串归一化回 null（回到「用默认」）', () => {
    const s = useSettingsStore()
    s.set('outTime', '08:00')
    expect(s.settings.outTime).toBe('08:00')
    s.set('outTime', '')
    expect(s.settings.outTime).toBe(null)
  })
})
