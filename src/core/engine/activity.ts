// ActivityEngine：活动强度 → 代谢、自生风、暴露（雨/晒）、透气温需求

import { ACTIVITY } from '../config'
import type { ActivityKind } from '../types'
import { THERMAL } from '../config'

export interface ResolvedActivity {
  met: number
  /** 自生风（骑行/跑步造成的气流）m/s */
  selfWindMs: number
  /** 太阳暴露系数 0-1 */
  sunExposure: number
  /** 雨暴露系数 0-1 */
  rainExposure: number
  /** 因代谢产热而降低的需求 clo */
  metabolicCloReduce: number
  /** 是否需要更透气的需求（高强度活动） */
  breathabilityBoost: boolean
}

export function resolveActivity(activity: ActivityKind): ResolvedActivity {
  const def = ACTIVITY[activity] ?? ACTIVITY.WALKING
  // 代谢产热抬升体感 → 等效于降低所需保暖
  const metabolicCloReduce = Math.max(0, (def.met - 1) / THERMAL.metabolicOffsetPerMet)
  return {
    met: def.met,
    selfWindMs: def.selfWindMs,
    sunExposure: def.sunExposure,
    rainExposure: def.rainExposure,
    metabolicCloReduce,
    breathabilityBoost: def.met >= 3.5,
  }
}

/** 活动可选清单（UI 展示用；必须与 ACTIVITY 枚举一致，否则出现"引擎支持但用户选不到"） */
export const SELECTABLE_ACTIVITIES: { value: ActivityKind; label: string }[] = [
  { value: 'HOME', label: '居家' },
  { value: 'OFFICE', label: '办公' },
  { value: 'CLASS', label: '上课' },
  { value: 'WALKING', label: '步行' },
  { value: 'CYCLING', label: '骑行' },
  { value: 'RUNNING', label: '跑步' },
  { value: 'OUTDOOR_WORK', label: '户外工作' },
  { value: 'OUTDOOR_LEISURE', label: '户外休闲' },
  { value: 'DRIVING', label: '开车' },
]