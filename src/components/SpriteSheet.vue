<script setup lang="ts">
// 雪碧图宿主：整份图标只在应用根部挂载一次，各处用 <use href="#id"> 引用
// 用 width/height 0 + overflow hidden 而非 display:none —— 后者会让部分浏览器断开 use 引用
import { GARMENT_SPRITE } from './garmentSprite'
</script>

<template>
  <svg
    class="sprite-sheet"
    aria-hidden="true"
    v-html="GARMENT_SPRITE"
  />
</template>

<style scoped>
.sprite-sheet {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
  pointer-events: none;
}
</style>
