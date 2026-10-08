<script setup lang="ts">
// 状态点：通道一的确认位。实心橘点 = 正穿着，虚线空心圆 = 带着备用
// 44pt 是可触摸目标下限，不做成装饰性小圆点
withDefaults(
  defineProps<{
    active: boolean
    size?: number
  }>(),
  { size: 44 },
)
</script>

<template>
  <span
    class="dot"
    :class="{ on: active, off: !active }"
    :style="{ width: `${size}px`, height: `${size}px` }"
    aria-hidden="true"
  >
    <i v-if="active" />
  </span>
</template>

<style scoped lang="scss">
.dot {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: var(--sw) solid var(--ink);
}

/* 带着备用：虚线圆，看得见但不抢注意力 */
.dot.off {
  background: transparent;
  border-style: dashed;
}

/* 正穿着：实心橘 + 白点 */
.dot.on {
  background: var(--orange);
}

.dot.on i {
  display: block;
  width: 37%;
  height: 37%;
  border-radius: 50%;
  background: #fff;
}
</style>
