<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";

defineProps<{ text: string }>();

const visible = ref(false);
const pos = ref({ x: 0, y: 0 });
const anchor = ref<HTMLElement | null>(null);

function show() {
  if (!anchor.value) return;
  const r = anchor.value.getBoundingClientRect();
  pos.value = {
    x: Math.max(140, Math.min(window.innerWidth - 140, r.left + r.width / 2)),
    y: r.top - 8,
  };
  visible.value = true;
}

function hide() {
  visible.value = false;
}

onBeforeUnmount(hide);
</script>

<template>
  <span
    ref="anchor"
    class="hint"
    tabindex="0"
    @mouseenter="show"
    @mouseleave="hide"
    @focus="show"
    @blur="hide"
  >
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2">
      <circle cx="8" cy="8" r="6.4" />
      <path d="M6.2 6.1a1.9 1.9 0 1 1 2.7 1.7c-.6.3-.9.7-.9 1.5" stroke-linecap="round" />
      <circle cx="8" cy="11.6" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  </span>
  <Teleport to="body">
    <div
      v-if="visible"
      class="hint-tip"
      :style="{ left: `${pos.x}px`, top: `${pos.y}px` }"
    >
      {{ text }}
    </div>
  </Teleport>
</template>

<style scoped>
.hint {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
  color: var(--muted);
  margin-left: 4px;
  cursor: help;
}
.hint:focus {
  outline: none;
}
.hint-tip {
  position: fixed;
  z-index: 2000;
  transform: translate(-50%, -100%);
  width: max-content;
  max-width: 260px;
  padding: 8px 10px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  color: var(--text);
  font-size: 13px;
  line-height: 1.5;
  white-space: normal;
  pointer-events: none;
}
</style>
