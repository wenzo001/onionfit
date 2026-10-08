<script setup lang="ts">
// 服装图标：引用内联雪碧图的 symbol，三通道着色（--gf 主体 / --gs 次要部件 / --ga 点缀）
// 通道一 = 穿着状态：正穿用图形自带彩色实心；带着备用只把填充换成所在行底色（空心），造型不变
import { computed } from 'vue'
import { strokeWidthFor } from './garments'
import type { LayerRole } from '@/core/types'

const props = withDefaults(
  defineProps<{
    /** symbol id，如 of-ins-sweater */
    icon: string
    /** 渲染边长 px（描边按设计对应表加粗） */
    size?: number
    /** 带着备用 = 空心 */
    carried?: boolean
    /** 空心时的"所在行底色"来源，缺省按白卡 */
    role?: LayerRole | 'ACCESSORY'
    /** 无障碍名称；不传则视为装饰性图形 */
    label?: string
  }>(),
  { size: 40, carried: false, role: undefined, label: undefined },
)

// 与图鉴分区底色完全一致（token 同名变量），空心即"填成行底色"
const HOLLOW_FILL: Record<string, string> = {
  PROTECTION: 'var(--layer-protection)',
  INSULATION: 'var(--layer-insulation)',
  BASE: 'var(--layer-base)',
  ACCESSORY: 'var(--layer-accessory)',
}

const stroke = computed(() => strokeWidthFor(props.size))
const viewBox = computed(() => (props.icon === 'of-mascot-onion' ? '0 0 140 160' : '0 0 72 72'))

const styleVars = computed<Record<string, string>>(() => {
  const vars: Record<string, string> = { '--sw': String(stroke.value) }
  if (props.carried) {
    const fill = HOLLOW_FILL[props.role ?? 'BASE']
    Object.assign(vars, { '--gf': fill, '--gs': fill, '--ga': 'transparent' })
  }
  return vars
})
</script>

<template>
  <svg
    class="garment"
    :style="{ width: `${size}px`, height: `${size}px`, ...styleVars }"
    :viewBox="viewBox"
    :stroke-width="stroke"
    :role="label ? 'img' : undefined"
    :aria-label="label"
    :aria-hidden="label ? undefined : 'true'"
  >
    <use :href="`#${icon}`" />
  </svg>
</template>

<style scoped>
.garment {
  display: block;
  flex-shrink: 0;
}
</style>
