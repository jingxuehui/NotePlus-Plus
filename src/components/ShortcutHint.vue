<script setup lang="ts">
import { t } from "@/i18n";
import { togglePalette } from "@/stores/ui";
</script>

<template>
  <span
    class="icon-btn"
    :title="t('palette.cmd.commandPalette')"
    @click="togglePalette('command', true)"
  >
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 1.5a6.5 6.5 0 0 0 0 13c.9 0 1.4-.7 1.4-1.4 0-.4-.2-.7-.4-1-.2-.3-.3-.5-.3-.8 0-.7.6-1.3 1.3-1.3h1.6A3.4 3.4 0 0 0 15 6.6C15 3.8 11.9 1.5 8 1.5z" />
      <circle cx="5" cy="6.2" r=".9" fill="currentColor" stroke="none" />
      <circle cx="8" cy="4.3" r=".9" fill="currentColor" stroke="none" />
      <circle cx="11" cy="5.4" r=".9" fill="currentColor" stroke="none" />
      <circle cx="5.4" cy="9.5" r=".9" fill="currentColor" stroke="none" />
    </svg>
  </span>
</template>

<style scoped>
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: pointer;
}
</style>
