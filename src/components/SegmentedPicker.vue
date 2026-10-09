<script setup lang="ts">
// 分段选择器：选中项 = 橘色胶囊（此刻的行动答案色），多选项时横向滚动不压缩标签
// multiple = 多选（风格）：modelValue 传数组，点选切换成员而不是替换
import type { SegmentedOption } from './segmentedTypes'

const props = withDefaults(
  defineProps<{
    options: SegmentedOption<string | number>[]
    modelValue: string | number | (string | number)[]
    /** 选项多时可横向滚动（不压缩标签），默认 false 均分 */
    scrollable?: boolean
    /** 多选模式：点选切换，modelValue 为数组 */
    multiple?: boolean
  }>(),
  { scrollable: false, multiple: false },
)

const emit = defineEmits<{
  'update:modelValue': [value: string | number | (string | number)[]]
}>()

function isSelected(value: string | number): boolean {
  return props.multiple
    ? (props.modelValue as (string | number)[]).includes(value)
    : props.modelValue === value
}

function select(option: SegmentedOption<string | number>) {
  if (props.multiple) {
    const next = [...(props.modelValue as (string | number)[])]
    const i = next.indexOf(option.value)
    if (i >= 0) next.splice(i, 1)
    else next.push(option.value)
    emit('update:modelValue', next)
    return
  }
  if (option.value !== props.modelValue) emit('update:modelValue', option.value)
}
</script>

<template>
  <div
    class="segmented"
    :class="{ scroll: scrollable }"
    :role="multiple ? 'group' : 'tablist'"
  >
    <button
      v-for="option in options"
      :key="String(option.value)"
      class="seg-option"
      :class="{ selected: isSelected(option.value), 'has-sub': option.sub }"
      type="button"
      :role="multiple ? undefined : 'tab'"
      :aria-selected="multiple ? undefined : isSelected(option.value)"
      :aria-pressed="multiple ? isSelected(option.value) : undefined"
      @click="select(option)"
    >
      <slot
        name="option"
        :option="option"
      >
        <span class="seg-label">{{ option.label }}</span>
        <span
          v-if="option.sub"
          class="seg-sub"
        >{{ option.sub }}</span>
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
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
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

.seg-sub {
  font-size: 10.5px;
  font-weight: 400;
  line-height: 1.3;
  color: rgba(0, 0, 0, 0.62);
}

/* 两行选项（带刻度）：圆角收一点，避免胶囊被拉成长条 */
.seg-option.has-sub {
  border-radius: calc(var(--r) - 2px);
  padding: 5px 8px;
}

.seg-option.selected {
  background: var(--orange);
  border-color: var(--ink);
  color: #fff;
  box-shadow: 2px 2px 0 var(--ink);
}

.seg-option.selected .seg-sub {
  color: rgba(255, 255, 255, 0.85);
}

.segmented.scroll {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
  padding-bottom: 2px;

  .seg-option {
    flex: 0 0 auto;
    padding: 6px 14px;
  }
}
</style>
