<script setup lang="ts">
// 我的（屏 04）：五项输入 + 「改完立刻重算」的证据 + 图鉴/状态墙等入口
// 全部输入都有默认值，改完界面立刻重算（不重新拉网络）
import { computed, ref, watch } from 'vue'
import InkCard from '@/components/InkCard.vue'
import BadgePill from '@/components/BadgePill.vue'
import SectionTitle from '@/components/SectionTitle.vue'
import SegmentedPicker from '@/components/SegmentedPicker.vue'
import TimePicker from '@/components/TimePicker.vue'
import { usePlan } from '@/composables/usePlan'
import { SELECTABLE_ACTIVITIES } from '@/core/engine/activity'
import { activityDiff } from '@/presentation'
import type { ActivityKind, BodyProfile, HeatSensitivity } from '@/core/types'

const { weather, settings, recommendation, planAs } = usePlan()

const PROFILE: { value: BodyProfile; label: string }[] = [
  { value: 'ADULT', label: '成人' },
  { value: 'CHILD', label: '儿童' },
  { value: 'ELDERLY', label: '老人' },
]

const SENS: { value: HeatSensitivity; label: string }[] = [
  { value: 'COLD_SENSITIVE', label: '怕冷' },
  { value: 'NORMAL', label: '标准' },
  { value: 'HEAT_SENSITIVE', label: '怕热' },
]

/** 预览目标活动：不选当前值，否则差异恒为 0，「重算有效」就证明不了 */
const previewActivity = computed<ActivityKind>(() => {
  const current = settings.activity
  const prefer: ActivityKind[] = ['CYCLING', 'WALKING', 'OFFICE', 'RUNNING']
  return prefer.find((a) => a !== current) ?? 'WALKING'
})

const previewLabel = computed(
  () => SELECTABLE_ACTIVITIES.find((a) => a.value === previewActivity.value)?.label ?? '别的',
)

const previewDiff = computed(() => {
  const rec = recommendation.value
  const alt = planAs(previewActivity.value)
  if (!rec || !alt) return null
  return activityDiff(rec, alt, previewLabel.value)
})

/** 改动后 1.6 秒内显示「已重算」，证明设置真的接进了结论 */
const recalced = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
watch(
  () => settings.settings,
  () => {
    recalced.value = true
    clearTimeout(timer)
    timer = setTimeout(() => (recalced.value = false), 1600)
    weather.persist()
  },
  { deep: true },
)

const ENTRIES = [
  { to: 'gallery', label: '服装图鉴', note: '24 件图形 · 按层角色分区' },
  { to: 'iconDay', label: '图标版主屏', note: '纯图形 · 零文字' },
  { to: 'states', label: '状态墙', note: '8 个真实会发生的边界' },
  { to: 'city', label: '换城市', note: '定位被拒也能手动选' },
] as const
</script>

<template>
  <div class="page">
    <div class="screen">
      <section class="col col-wide">
        <div class="head">
          <SectionTitle
            title="我在为谁穿衣？"
            sub="五项都有默认值"
          />
          <BadgePill :tone="recalced ? 'orange' : 'yellow'">
            {{ recalced ? '已重算' : '改完立刻重算' }}
          </BadgePill>
        </div>
      </section>

      <section class="col">
        <InkCard class="field">
          <div class="label">
            为谁穿衣
            <span class="hint">老人孩子更怕冷、更怕晒</span>
          </div>
          <SegmentedPicker
            :options="PROFILE"
            :model-value="settings.profile"
            @update:model-value="settings.set('profile', $event)"
          />
        </InkCard>

        <InkCard class="field">
          <div class="label">
            冷热体质
            <span class="hint">怕冷 = −2°，怕热 = +1.5°</span>
          </div>
          <SegmentedPicker
            :options="SENS"
            :model-value="settings.sensitivity"
            @update:model-value="settings.set('sensitivity', $event)"
          />
        </InkCard>

        <InkCard class="field">
          <div class="label">
            今天主要活动
            <span class="hint">影响最大，骑车和走路完全不同</span>
          </div>
          <SegmentedPicker
            scrollable
            :options="SELECTABLE_ACTIVITIES"
            :model-value="settings.activity"
            @update:model-value="settings.set('activity', $event)"
          />
        </InkCard>
      </section>

      <section class="col">
        <InkCard class="field">
          <div class="label">
            出门和回家时间
            <span class="hint">填了带伞结论差很多</span>
          </div>
          <div class="time-pair">
            <TimePicker
              :model-value="settings.outTime"
              placeholder="出门"
              @update:model-value="settings.set('outTime', $event)"
            />
            <span class="sep">→</span>
            <TimePicker
              :model-value="settings.homeTime"
              placeholder="回家"
              @update:model-value="settings.set('homeTime', $event)"
            />
          </div>
          <p
            v-if="!settings.hasSchedule"
            class="tip"
          >
            没填时按 07:30 / 18:00 估算，带伞卡上会写明是估的。
          </p>
        </InkCard>

        <InkCard
          v-if="previewDiff"
          tone="paper"
          class="compare"
        >
          <div class="cmp-head">
            <b>换成{{ previewLabel }}呢？</b>
            <button
              type="button"
              class="cmp-btn"
              @click="settings.set('activity', previewActivity)"
            >
              看{{ previewLabel }}版
            </button>
          </div>
          <p class="cmp-body">{{ previewDiff }}</p>
        </InkCard>

        <div class="entries">
          <RouterLink
            v-for="e in ENTRIES"
            :key="e.to"
            class="entry"
            :to="{ name: e.to }"
          >
            <b>{{ e.label }}</b>
            <span>{{ e.note }}</span>
          </RouterLink>
        </div>

        <p class="meta">
          数据源 {{ weather.sourceLabel }} · 结论纯本地计算 · 定位方式
          {{ weather.locationSource === 'ip' ? 'IP 兜底' : weather.locationSource === 'gps' ? '精确定位' : '手动选择' }}
        </p>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/tokens' as *;

.col {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.col-wide {
  grid-column: 1 / -1;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: #{$sp};
  flex-wrap: wrap;
}

.field {
  padding: #{$sp * 1.5};
}

.label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: #{$title-weight};
  color: var(--ink);
}

.hint {
  font-size: 11.5px;
  font-weight: 400;
  color: rgba(0, 0, 0, 0.66);
}

.time-pair {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.sep {
  font-family: var(--font-num);
  color: rgba(0, 0, 0, 0.5);
}

.tip {
  margin-top: 8px;
  font-size: 11.5px;
  color: #{$warn};
  font-weight: 700;
}

.compare {
  padding: #{$sp} #{$sp * 1.5};
}

.cmp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: #{$sp};
}

.cmp-head b {
  font-size: 14px;
  font-weight: #{$title-weight};
  color: var(--ink);
}

.cmp-btn {
  min-height: 44px;
  padding: 0 #{$sp * 1.5};
  border: var(--sw) solid var(--ink);
  border-radius: var(--r-pill);
  background: var(--orange);
  color: var(--ink);
  font-size: 12.5px;
  font-weight: 800;
}

.cmp-body {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.6;
  color: rgba(0, 0, 0, 0.78);
}

.entries {
  display: grid;
  gap: 8px;
}

.entry {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 44px;
  padding: 6px #{$sp * 1.5};
  border: var(--sw) solid var(--ink);
  border-radius: var(--r);
  background: var(--card);
  box-shadow: 2px 2px 0 var(--ink);
  text-decoration: none;
  color: var(--ink);

  &:active {
    transform: translate(2px, 2px);
    box-shadow: none;
  }
}

.entry b {
  font-size: 13.5px;
  font-weight: #{$title-weight};
}

.entry span {
  font-size: 11px;
  color: rgba(0, 0, 0, 0.62);
}

.meta {
  font-family: var(--font-num);
  font-size: 11px;
  color: rgba(0, 0, 0, 0.55);
}
</style>
