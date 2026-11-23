<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { tipState } from "@/stores/tooltip";

const el = ref<HTMLElement | null>(null);
const width = ref(0);

watch(
  () => [tipState.visible, tipState.text],
  async () => {
    if (!tipState.visible) return;
    await nextTick();
    width.value = el.value?.offsetWidth ?? 0;
  }
);

// 按实际气泡宽度收敛位置，确保气泡对准图标且不被窗口边缘裁切
const left = computed(() => {
  const half = width.value / 2;
  if (!half) return tipState.x;
  return Math.max(half + 6, Math.min(window.innerWidth - half - 6, tipState.x));
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="tipState.visible"
      ref="el"
      class="app-tip"
      :class="[tipState.placement, { compact: tipState.compact }]"
      :style="{ left: `${left}px`, top: `${tipState.y}px` }"
    >
      {{ tipState.text }}
    </div>
  </Teleport>
</template>

<style scoped>
.app-tip {
  position: fixed;
  z-index: 3000;
  transform: translate(-50%, -100%);
  width: max-content;
  max-width: 320px;
  padding: 10px 14px;
  background: var(--tip-bg);
  border: 1px solid var(--tip-border);
  border-radius: 10px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
  color: var(--tip-text);
  font-size: 15px;
  font-weight: 500;
  line-height: 1.4;
  text-align: center;
  white-space: normal;
  pointer-events: none;
}
.app-tip::after {
  content: "";
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 7px solid transparent;
  border-top-color: var(--tip-border);
}
.app-tip::before {
  content: "";
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: var(--tip-bg);
  z-index: 1;
}
/* 顶栏提示：字号与内边距收紧 */
.app-tip.compact {
  padding: 6px 9px;
  border-radius: 7px;
  font-size: 12px;
}
.app-tip.compact::after {
  border-width: 6px;
}
.app-tip.compact::before {
  border-width: 5px;
}
/* 顶部元素：气泡显示在下方，箭头朝上 */
.app-tip.bottom {
  transform: translate(-50%, 0);
}
.app-tip.bottom::after {
  top: auto;
  bottom: 100%;
  border-top-color: transparent;
  border-bottom-color: var(--tip-border);
}
.app-tip.bottom::before {
  top: auto;
  bottom: 100%;
  border-top-color: transparent;
  border-bottom-color: var(--tip-bg);
}
</style>
