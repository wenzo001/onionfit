<script setup lang="ts">
// 今天 24 小时曲线：折线是气温，橙点是脱衣时刻，蓝带是雨，粉线是「现在」
// 让逻辑自己说话 ——「现在不冷却让你带外套」不用辩解，看图上哪个点最需要它
import { computed } from 'vue'
import { fmtTempC, rainBand } from '@/presentation'
import type { HourlyEnvironment } from '@/core/types'

const props = defineProps<{
  hourly: HourlyEnvironment[]
  nowHour: number
  /** 脱衣时刻（timeline 的第一个 REMOVE），没有就不画点 */
  doffHour?: number | null
}>()

const W = 300
const H = 76
const PAD = 6

const pts = computed(() => {
  const hs = props.hourly.slice(0, 24)
  if (hs.length < 2) return { ok: false, line: '', min: 0, max: 0, xAt: () => null, yAt: () => null, xRatio: () => 0 }
  const temps = hs.map((h) => h.temperatureC)
  const min = Math.min(...temps)
  const max = Math.max(...temps)
  const span = max - min || 1
  const x = (i: number) => PAD + (i / (hs.length - 1)) * (W - PAD * 2)
  const y = (t: number) => H - PAD - ((t - min) / span) * (H - PAD * 2)
  const indexOfHour = (h: number) => hs.findIndex((p) => new Date(p.time).getHours() === h)
  return {
    ok: true,
    min,
    max,
    line: hs.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.temperatureC).toFixed(1)}`).join(' '),
    xAt: (h: number) => {
      const i = indexOfHour(h)
      return i < 0 ? null : x(i)
    },
    yAt: (h: number) => {
      const i = indexOfHour(h)
      return i < 0 ? null : y(temps[i])
    },
    xRatio: (h: number) => PAD + (Math.min(23, Math.max(0, h)) / (hs.length - 1)) * (W - PAD * 2),
  }
})

const band = computed(() => rainBand(props.hourly.slice(0, 24)))
const bandRect = computed(() => {
  const b = band.value
  if (!b || !pts.value.ok) return null
  const x1 = pts.value.xRatio(b.start)
  const x2 = pts.value.xRatio(Math.min(23, b.end))
  return { x: x1, w: Math.max(6, x2 - x1), text: `${b.start}-${b.end} 雨` }
})

const doff = computed(() => {
  if (props.doffHour == null || !pts.value) return null
  const x = pts.value.xAt(props.doffHour)
  const y = pts.value.yAt(props.doffHour)
  return x == null || y == null ? null : { x, y }
})

const nowX = computed(() => (pts.value ? pts.value.xRatio(props.nowHour) : null))
const ticks = [0, 6, 12, 18, 23]
</script>

<template>
  <div
    v-if="pts.ok"
    class="curve"
  >
    <svg
      class="svg"
      :viewBox="`0 0 ${W} ${H}`"
      role="img"
      :aria-label="`今天 ${fmtTempC(pts.min)} 到 ${fmtTempC(pts.max)}`"
    >
      <rect
        v-if="bandRect"
        :x="bandRect.x"
        :y="0"
        :width="bandRect.w"
        :height="H"
        fill="var(--blue-lite)"
        opacity="0.5"
        stroke="rgba(0, 0, 0, 0.45)"
        stroke-width="1.5"
      />
      <path
        :d="pts.line"
        fill="none"
        stroke="var(--ink)"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <line
        v-if="nowX != null"
        :x1="nowX"
        :x2="nowX"
        y1="0"
        :y2="H"
        stroke="var(--pink)"
        stroke-width="2.5"
        stroke-dasharray="4 3"
      />
      <circle
        v-if="doff"
        :cx="doff.x"
        :cy="doff.y"
        r="5.5"
        fill="var(--orange)"
        stroke="var(--ink)"
        stroke-width="2"
      />
    </svg>

    <div class="scale">
      <span
        v-for="t in ticks"
        :key="t"
        class="tick"
      >{{ t === 23 ? '24时' : `${t}时` }}</span>
    </div>

    <div class="legend">
      <span>最低 {{ fmtTempC(pts.min) }}</span>
      <span>最高 {{ fmtTempC(pts.max) }}</span>
      <span
        v-if="bandRect"
        class="rain"
      >{{ bandRect.text }}</span>
      <span
        v-if="doff"
        class="doff"
      >橙点 = 脱衣</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/tokens' as *;

.svg {
  display: block;
  width: 100%;
  height: 76px;
}

.scale {
  display: flex;
  justify-content: space-between;
  margin-top: 2px;
  font-family: var(--font-num);
  font-size: 10.5px;
  color: rgba(0, 0, 0, 0.6);
}

.tick {
  // 刻度对齐曲线两端
  min-width: 26px;

  &:last-child {
    text-align: right;
  }
}

.legend {
  display: flex;
  gap: #{$sp};
  flex-wrap: wrap;
  margin-top: 6px;
  font-size: 11.5px;
  font-weight: 700;
  color: rgba(0, 0, 0, 0.78);
}

.rain {
  padding: 1px 7px;
  border: 2px solid var(--ink);
  border-radius: var(--r-pill);
  background: var(--blue-lite);
  color: var(--ink);
}

.doff {
  color: #{$warn};
}
</style>
