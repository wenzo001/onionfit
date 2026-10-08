<script setup lang="ts">
// 出门/回家时间：直接把原生 <input type=time> 画成墨线控件
// （不用「按钮里套 input」——嵌套可交互元素既不合法，也让真实点击区小于 44pt）
defineProps<{
  modelValue: string | null
  placeholder: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

function onChange(e: Event) {
  const input = e.target as HTMLInputElement
  emit('update:modelValue', input.value || null)
}
</script>

<template>
  <div class="time-field">
    <label class="time-box">
      <span class="sr">{{ placeholder }}</span>
      <input
        type="time"
        class="time-input num"
        :class="{ empty: !modelValue }"
        :value="modelValue ?? ''"
        :aria-label="placeholder"
        @change="onChange"
      />
    </label>
    <button
      v-if="modelValue"
      type="button"
      class="clear-btn"
      aria-label="清除时间"
      @click="emit('update:modelValue', null)"
    >
      ×
    </button>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/tokens' as *;

.time-field {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}

.time-box {
  display: inline-flex;
  border: var(--sw) solid var(--ink);
  border-radius: var(--r);
  background: var(--card);

  &:focus-within {
    box-shadow: 2px 2px 0 var(--ink);
  }
}

/* 原生控件自带滚轮入口，这里只保证外观与 44pt 命中区 */
.time-input {
  min-width: 104px;
  min-height: 44px;
  padding: 6px 10px;
  border: none;
  outline: none;
  background: transparent;
  color: var(--ink);
  font-family: var(--font-num);
  font-size: 15px;
  font-weight: #{$numeral-weight};

  &.empty {
    color: rgba(0, 0, 0, 0.45);
  }

  &::-webkit-calendar-picker-indicator {
    opacity: 0.55;
  }
}

.time-box:has(.time-input.empty) {
  border-style: dashed;
  background: var(--paper);
}

.clear-btn {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: rgba(0, 0, 0, 0.6);
  font-size: 20px;
  font-weight: #{$numeral-weight};
  line-height: 1;

  &:active {
    transform: none;
    color: var(--ink);
  }
}
</style>
