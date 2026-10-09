<script setup lang="ts">
// 服装图鉴（屏 09）：24 件图形按 4 个层角色分区，无文字
// 用户在图鉴里学到的分区底色，到主屏的层卡行完全一致 —— 不必重新学一遍
import GarmentIcon from '@/components/GarmentIcon.vue'
import SectionTitle from '@/components/SectionTitle.vue'
import { GARMENT_ICONS } from '@/components/garments'
import type { IconRole } from '@/components/garments'

const GROUPS: { role: IconRole; title: string; sub: string }[] = [
  { role: 'PROTECTION', title: '防护层', sub: '3 号位 · 最外' },
  { role: 'INSULATION', title: '保暖层', sub: '2 号位 · 中间' },
  { role: 'BASE', title: '贴身层', sub: '1 号位 · 最内' },
  { role: 'ACCESSORY', title: '配饰', sub: '带不带，不是穿不穿' },
]

const cells = GARMENT_ICONS
</script>

<template>
  <div class="page">
    <div class="screen">
      <section class="col col-wide">
        <SectionTitle
          title="服装图鉴"
          sub="24 件 · 零文字 · 底色即层角色"
        />
      </section>

      <section
        v-for="g in GROUPS"
        :key="g.role"
        class="col"
      >
        <SectionTitle
          :title="g.title"
          :sub="g.sub"
        />
        <div class="grid">
          <div
            v-for="it in cells.filter((c) => c.role === g.role)"
            :key="it.id"
            class="cell"
            :class="`role-${g.role}`"
          >
            <GarmentIcon
              :icon="it.id"
              :size="92"
              :role="g.role === 'ACCESSORY' ? undefined : g.role"
              :label="it.name"
            />
          </div>
        </div>
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

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(102px, 1fr));
  gap: 10px;
}

.cell {
  display: grid;
  place-items: center;
  aspect-ratio: 1;
  padding: 6px;
  border: var(--sw) solid var(--ink);
  border-radius: var(--r);
  box-shadow: 2px 2px 0 var(--ink);
}

.cell > :deep(svg) {
  width: 78%;
  height: 78%;
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

.role-ACCESSORY {
  background: var(--layer-accessory);
}
</style>
