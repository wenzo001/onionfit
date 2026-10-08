<script setup lang="ts">
// 层卡行（主屏核心组件 A）：图标 + 文本列 + 状态点
// 通道二 = 行底色（与服装图鉴分区色一致）；带着备用的行用虚线边框 + 空心图标
import { computed } from 'vue'
import GarmentIcon from './GarmentIcon.vue'
import StatusDot from './StatusDot.vue'
import { iconForItem } from './garments'
import { layerLine } from '@/presentation'
import type { ApparelLayer, TimelineEvent } from '@/core/types'

const props = defineProps<{
  layer: ApparelLayer
  timeline: TimelineEvent[]
  /** 图标版（屏 10）：零文字，只留图形 + 状态点 */
  graphic?: boolean
}>()

const line = computed(() => layerLine(props.layer, props.timeline))
const iconSize = computed(() => (props.graphic ? 92 : props.layer.role === 'BASE' ? 64 : 70))
/** 同层上下装两件时，图形取第一件（形状认衣服，名称已在文本列里） */
const iconId = computed(() => {
  const it = props.layer.items[0]
  return it ? iconForItem(it.id, props.layer.role) : 'of-base-long'
})
</script>

<template>
  <div
    class="layer-row"
    :class="[`role-${line.role}`, { carried: !line.active }]"
  >
    <GarmentIcon
      class="glyph"
      :icon="iconId"
      :size="iconSize"
      :carried="!line.active"
      :role="line.role"
      :label="graphic ? `${line.title} ${line.subtitle}` : undefined"
    />
    <div
      v-if="!graphic"
      class="body"
    >
      <b>{{ line.title }}</b>
      <span :class="{ warn: line.active && line.role === 'INSULATION' }">{{ line.subtitle }}</span>
    </div>
    <StatusDot :active="line.active" />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/tokens' as *;

.layer-row {
  display: flex;
  align-items: center;
  gap: #{$sp * 1.5};
  border: var(--sw) solid var(--ink);
  border-radius: var(--r);
  // 左偏移让硬阴影与文本列对齐；带图标的一侧留足呼吸位
  padding: #{$sp} #{$sp} #{$sp} #{$sp * 1.5};
  min-height: 86px;
}

.layer-row.carried {
  border-style: dashed;
  min-height: 78px;
}

.role-PROTECTION {
  background: var(--layer-protection);
}

.role-INSULATION {
  background: var(--layer-insulation);
}

.role-BASE {
  background: var(--layer-base);
}

.glyph {
  flex: 0 0 auto;
}

.body {
  flex: 1;
  min-width: 0;
}

.body b {
  display: block;
  font-size: 15px;
  font-weight: #{$title-weight};
  line-height: 1.35;
  color: var(--ink);
  // 衣物名可能被压缩，宁缺不截
  overflow-wrap: break-word;
}

.body span {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  line-height: 1.5;
  color: rgba(0, 0, 0, 0.72);
}

/* 正文里的提醒强调（脱衣时刻）用警示字；保暖行底色偏黄，用深一档才到 4.5 */
.body span.warn {
  color: var(--warn-deep);
  font-weight: 700;
}
</style>
