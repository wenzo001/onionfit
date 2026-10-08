<script setup lang="ts">
// 分段选择器：选中项 = 橘色胶囊（此刻的行动答案色），多选项时横向滚动不压缩标签
import type { SegmentedOption } from './segmentedTypes'

const props = withDefaults(
  defineProps<{
    options: SegmentedOption<string | number>[]
    modelValue: string | number
    /** 选项多时可横向滚动（不压缩标签），默认 false 均分 */
    scrollable?: boolean
  }>(),
  { scrollable: false },
)

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

function select(option: SegmentedOption<string | number>) {
  if (option.value !== props.modelValue) emit('update:modelValue', option.value)
}
</script>

<template>
  <div
    class="segmented"
    :class="{ scroll: scrollable }"
    role="tablist"
  >
    <button
      v-for="option in options"
      :key="String(option.value)"
      class="seg-option"
      :class="{ selected: option.value === modelValue }"
      type="button"
      role="tab"
      :aria-selected="option.value === modelValue"
      @click="select(option)"
    >
      <slot
        name="option"
        :option="option"
      >
        {{ option.label }}
      </slot>
    </button>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/tokens' as *;

.segmented {
  display: flex;
  gap: 6px;
}

.seg-option {
  flex: 1;
  // 触摸目标 44pt 下限
  min-height: 44px;
  padding: 6px 8px;
  border: 2px solid var(--ink);
  border-radius: var(--r-pill);
  font-size: 13px;
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--ink);
  background: var(--card);
}

.seg-option.selected {
  background: var(--orange);
  border-color: var(--ink);
  color: #fff;
  box-shadow: 2px 2px 0 var(--ink);
}

.segmented.scroll {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 2px;

  .seg-option {
    flex: 0 0 auto;
    padding: 6px 14px;
  }
}
</style>
