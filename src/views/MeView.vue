<script setup lang="ts">
// 我的（deck 14）：12 个维度全部有默认值 + 「已改 N 项 · M 项用默认」
// 两组：谁在穿（影响安全边界）/ 今天怎么过（影响暴露与风雨）；⑨⑩⑪⑫ 收进「穿成什么样」只做软排序
import { computed, ref, watch } from 'vue'
import InkCard from '@/components/InkCard.vue'
import BadgePill from '@/components/BadgePill.vue'
import SectionTitle from '@/components/SectionTitle.vue'
import SegmentedPicker from '@/components/SegmentedPicker.vue'
import TimePicker from '@/components/TimePicker.vue'
import { usePlan } from '@/composables/usePlan'
import { SELECTABLE_ACTIVITIES } from '@/core/engine/activity'
import type { SegmentedOption } from '@/components/segmentedTypes'
import type { ActivityKind } from '@/core/types'
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
  activityDiff,
  settingsCountLine,
  styleSummary,
} from '@/presentation'

const { weather, settings, recommendation, planAs } = usePlan()

const cur = computed(() => settings.settings)
const countLine = computed(() => settingsCountLine(settings.settings))
const summaryLine = computed(() => styleSummary(settings.settings))

/** 选项 = 标签表 + 设计稿顺序；成员由 Record 类型保证与引擎枚举一一对应 */
function options<T extends string>(
  labels: Record<T, string>,
  order: T[],
  sub?: (v: T) => string,
): SegmentedOption<T>[] {
  return order.map((v) => {
    const o: SegmentedOption<T> = { value: v, label: labels[v] }
    if (sub) o.sub = sub(v)
    return o
  })
}

const profileOpts = options(PROFILE_LABEL, PROFILE_ORDER)
const sensOpts = options(SENSITIVITY_LABEL, SENSITIVITY_ORDER)
const sweatOpts = options(SWEAT_LABEL, SWEAT_ORDER)
const habitOpts = options(HABIT_LABEL, HABIT_ORDER, (v) => HABIT_SUB[v])
const occasionOpts = options(OCCASION_LABEL, OCCASION_ORDER)
const styleOpts = options(STYLE_LABEL, STYLE_ORDER)
const presentationOpts = options(PRESENTATION_LABEL, PRESENTATION_ORDER)
const silhouetteOpts = options(SILHOUETTE_LABEL, SILHOUETTE_ORDER)
const colorOpts = options(COLOR_LABEL, COLOR_ORDER)

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
            title="今天怎么算"
            sub="12 个维度，全部有默认值"
          />
          <div class="chips">
            <BadgePill
              v-if="recalced"
              tone="orange"
            >
              已重算
            </BadgePill>
            <BadgePill tone="yellow">{{ countLine }}</BadgePill>
          </div>
        </div>
        <p class="lede">默认值都是中性的，不改也能拿到结论。</p>
      </section>

      <section class="col">
        <div class="group">
          <b>谁在穿</b>
          <span>影响安全边界</span>
        </div>

        <InkCard class="field">
          <div class="label">
            <i class="no">①</i>人群阶段
          </div>
          <SegmentedPicker
            :options="profileOpts"
            :model-value="cur.profile"
            @update:model-value="settings.set('profile', $event)"
          />
        </InkCard>

        <InkCard class="field">
          <div class="label">
            <i class="no">②</i>冷热偏好
          </div>
          <SegmentedPicker
            :options="sensOpts"
            :model-value="cur.sensitivity"
            @update:model-value="settings.set('sensitivity', $event)"
          />
          <p class="footnote">不用「男性一定耐冷」这类规则，偏好只来自你自己的选择。</p>
        </InkCard>

        <InkCard class="field">
          <div class="label">
            <i class="no">③</i>易出汗
          </div>
          <SegmentedPicker
            :options="sweatOpts"
            :model-value="cur.sweat ?? 'AVERAGE'"
            @update:model-value="settings.set('sweat', $event)"
          />
          <p class="footnote">提高排湿、速干、备用贴身层的偏好，但不抵消防寒。</p>
        </InkCard>
      </section>

      <section class="col">
        <div class="group">
          <b>今天怎么过</b>
          <span>影响暴露与风雨</span>
        </div>

        <InkCard class="field">
          <div class="label">
            <i class="no">④</i>今天主要做什么
          </div>
          <SegmentedPicker
            scrollable
            :options="SELECTABLE_ACTIVITIES"
            :model-value="cur.activity"
            @update:model-value="settings.set('activity', $event)"
          />
          <p class="footnote">「开车」也在选项里；9 种活动与引擎枚举一一对应，选不到的不存在。</p>
        </InkCard>

        <InkCard class="field">
          <div class="label">
            <i class="no">⑤</i>暴露习惯
          </div>
          <SegmentedPicker
            :options="habitOpts"
            :model-value="cur.exposureHabit ?? 'SHORT_OUTDOOR'"
            @update:model-value="settings.set('exposureHabit', $event)"
          />
          <p class="footnote">决定安全时段和外层防护，不是只看整天最高 / 最低温。</p>
        </InkCard>

        <InkCard class="field">
          <div class="label">
            <i class="no">⑥</i>场合
          </div>
          <SegmentedPicker
            scrollable
            :options="occasionOpts"
            :model-value="cur.occasion ?? 'DAILY'"
            @update:model-value="settings.set('occasion', $event)"
          />
          <p class="footnote">场合约束正式程度与功能需求；风格是你想要的，场合是必须满足的。</p>
        </InkCard>

        <InkCard class="field">
          <div class="label">
            <i class="no">⑦⑧</i>出门 / 回家时刻
          </div>
          <div class="time-pair">
            <TimePicker
              :model-value="cur.outTime"
              placeholder="出门"
              @update:model-value="settings.set('outTime', $event)"
            />
            <span class="sep">→</span>
            <TimePicker
              :model-value="cur.homeTime"
              placeholder="回家"
              @update:model-value="settings.set('homeTime', $event)"
            />
          </div>
          <p
            v-if="!settings.hasSchedule"
            class="tip"
          >
            没填就按 07:30 / 18:00 估算 —— 会标成默认值，不等于你设过。
          </p>
        </InkCard>

        <details class="panel">
          <summary class="panel-head">
            <span class="tri">▸</span>
            <b>穿成什么样</b>
            <span class="g-sub">只做软排序</span>
          </summary>
          <p class="panel-sum">{{ summaryLine }}</p>
          <p class="panel-note">
            这 4 项只进候选排序，排在硬过滤与安全判定之后 —— 风格再合适，也不能让防护硬条件失效。该穿雨衣还是穿雨衣。
          </p>
          <div class="pipe">
            <span class="p-step">① 硬过滤</span>
            <span class="p-arrow">→</span>
            <span class="p-step">② 安全判定</span>
            <span class="p-arrow">→</span>
            <span class="p-step on">③ 风格排序</span>
          </div>

          <InkCard class="field">
            <div class="label">
              <i class="no">⑨</i>风格（可多选）
            </div>
            <SegmentedPicker
              multiple
              scrollable
              :options="styleOpts"
              :model-value="cur.styles ?? []"
              @update:model-value="settings.set('styles', $event)"
            />
          </InkCard>

          <InkCard class="field">
            <div class="label">
              <i class="no">⑩</i>穿搭呈现
            </div>
            <SegmentedPicker
              :options="presentationOpts"
              :model-value="cur.presentation ?? 'UNSPECIFIED'"
              @update:model-value="settings.set('presentation', $event)"
            />
            <p class="footnote">只影响款式与配色候选，不能改变天气事实和安全风险。</p>
          </InkCard>

          <InkCard class="field">
            <div class="label">
              <i class="no">⑪</i>版型偏好
            </div>
            <SegmentedPicker
              :options="silhouetteOpts"
              :model-value="cur.silhouette ?? 'REGULAR'"
              @update:model-value="settings.set('silhouette', $event)"
            />
          </InkCard>

          <InkCard class="field">
            <div class="label">
              <i class="no">⑫</i>色彩偏好（可选）
            </div>
            <SegmentedPicker
              scrollable
              :options="colorOpts"
              :model-value="cur.colorPreference ?? 'ANY'"
              @update:model-value="settings.set('colorPreference', $event)"
            />
          </InkCard>
        </details>
      </section>

      <section class="col col-wide">
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

.chips {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.lede {
  margin-top: 6px;
  font-size: 12.5px;
  line-height: 1.6;
  color: rgba(0, 0, 0, 0.72);
}

.group {
  display: flex;
  align-items: baseline;
  gap: #{$sp};
}

.group b {
  font-size: 15px;
  font-weight: #{$title-weight};
  color: var(--ink);
}

.group span {
  font-size: 11.5px;
  color: rgba(0, 0, 0, 0.6);
}

.field {
  padding: #{$sp * 1.5};
}

.label {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: #{$title-weight};
  color: var(--ink);
}

.no {
  font-style: normal;
  font-family: var(--font-num);
  font-size: 11px;
  font-weight: #{$numeral-weight};
  line-height: 1;
  padding: 3px 5px;
  border: 2px solid var(--ink);
  border-radius: 6px;
  background: var(--yellow);
}

.footnote {
  margin-top: 8px;
  font-size: 11.5px;
  line-height: 1.6;
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

/* 「穿成什么样」折叠面板：默认收起，展开才见 ⑨⑩⑪⑫ */
.panel {
  border: var(--sw) solid var(--ink);
  border-radius: var(--r);
  background: var(--paper);
  box-shadow: var(--shadow);

  > *:not(summary) {
    margin: 0 #{$sp * 1.5} #{$sp * 1.25};
  }
}

.panel-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 6px #{$sp * 1.5};
  cursor: pointer;
  list-style: none;

  &::-webkit-details-marker {
    display: none;
  }

  b {
    font-size: 14.5px;
    font-weight: #{$title-weight};
    color: var(--ink);
  }

  .g-sub {
    font-size: 11.5px;
    color: rgba(0, 0, 0, 0.6);
  }
}

.tri {
  font-family: var(--font-num);
  font-size: 13px;
  color: var(--ink);
  transition: transform 0.15s ease;
}

.panel[open] .tri {
  transform: rotate(90deg);
}

.panel-sum {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--ink);
}

.panel-note {
  font-size: 11.5px;
  line-height: 1.6;
  color: rgba(0, 0, 0, 0.66);
}

.pipe {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.p-step {
  font-size: 11.5px;
  font-weight: 800;
  padding: 4px 10px;
  border: 2px solid var(--ink);
  border-radius: var(--r-pill);
  background: var(--card);
  color: var(--ink);
}

.p-step.on {
  background: var(--yellow);
}

.p-arrow {
  font-family: var(--font-num);
  color: rgba(0, 0, 0, 0.5);
}

.panel .field + .field {
  margin-top: #{$sp * 1.25};
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
