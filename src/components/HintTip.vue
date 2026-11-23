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
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2">
      <circle cx="8" cy="8" r="6.4" />
      <path d="M6.2 6.1a1.9 1.9 0 1 1 2.7 1.7c-.6.3-.9.7-.9 1.5" stroke-linecap="round" />
      <circle cx="8" cy="11.6" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  </span>
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
</style>
