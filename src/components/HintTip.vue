<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
import { hideTip, showTip } from "@/stores/tooltip";

const props = defineProps<{ text: string }>();
const anchor = ref<HTMLElement | null>(null);

function show() {
  if (anchor.value) showTip(props.text, anchor.value.getBoundingClientRect());
}

onBeforeUnmount(hideTip);
</script>

<template>
  <span
    ref="anchor"
    class="hint"
    tabindex="0"
    @mouseenter="show"
    @mouseleave="hideTip"
    @focus="show"
    @blur="hideTip"
  >
    <svg class="hint-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
      <circle cx="8" cy="8" r="6.4" />
      <path d="M6.3 6.2a1.85 1.85 0 1 1 2.6 1.6c-.6.3-.95.7-.95 1.45" stroke-linecap="round" />
      <circle cx="8" cy="11.5" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  </span>
</template>

<style scoped>
.hint {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  flex: 0 0 14px;
  color: var(--muted);
  font-size: 0;
  line-height: 0;
  vertical-align: middle;
  margin-left: 4px;
  cursor: pointer;
}
.hint:focus {
  outline: none;
}
.hint-icon {
  display: block;
  width: 14px;
  height: 14px;
  flex: 0 0 14px;
}
</style>
