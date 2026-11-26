<script setup lang="ts">
/** 与 dbx 一致的语言图标：内置 SVG 旗帜，Windows 不依赖系统 emoji 字体 */
defineProps<{ option: { flag: string; flagIcon?: string } }>();
</script>

<template>
  <span aria-hidden="true" class="locale-flag">
    <img
      v-if="option.flagIcon"
      :src="`/icons/flags/${option.flagIcon}.svg`"
      alt=""
      width="20"
      height="15"
    />
    <span v-else>{{ option.flag }}</span>
  </span>
</template>

<style scoped>
.locale-flag {
  display: inline-flex;
  width: 24px;
  height: 20px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
  color: var(--muted);
}
.locale-flag img {
  width: 20px;
  height: 15px;
  border-radius: 1px;
  object-fit: contain;
}
</style>
