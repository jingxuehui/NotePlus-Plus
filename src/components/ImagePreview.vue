<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { Tab } from "@/stores/tabs";
import { t } from "@/i18n";

const props = defineProps<{ tab: Tab }>();

const MIN_SCALE = 0.05;
const MAX_SCALE = 32;
const STEP = 1.25;
/** 适应窗口时图片与边缘的留白（px） */
const PADDING = 32;

/** null 表示「适应窗口」，否则为固定缩放倍数 */
const scale = ref<number | null>(null);
const failed = ref(false);
const stage = ref<HTMLDivElement | null>(null);
const stageSize = ref({ w: 0, h: 0 });

watch(
  () => props.tab.id,
  () => {
    scale.value = null;
    failed.value = false;
  }
);

let observer: ResizeObserver | null = null;
onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    stageSize.value = { w: entry.contentRect.width, h: entry.contentRect.height };
  });
  if (stage.value) observer.observe(stage.value);
});
onBeforeUnmount(() => observer?.disconnect());

/** 适应窗口的缩放：放得下就按原尺寸显示，放不下才缩小 */
const fitScale = computed(() => {
  const { imageWidth: w, imageHeight: h } = props.tab;
  const { w: sw, h: sh } = stageSize.value;
  if (!w || !h || !sw || !sh) return 1;
  return Math.max(MIN_SCALE, Math.min(1, (sw - PADDING) / w, (sh - PADDING) / h));
});

const effectiveScale = computed(() => scale.value ?? fitScale.value);

const imgStyle = computed(() => {
  const { imageWidth: w, imageHeight: h } = props.tab;
  if (!w || !h) return {};
  return {
    width: `${w * effectiveScale.value}px`,
    height: `${h * effectiveScale.value}px`,
  };
});

function onLoad(e: Event) {
  const img = e.target as HTMLImageElement;
  props.tab.imageWidth = img.naturalWidth;
  props.tab.imageHeight = img.naturalHeight;
}

function zoomBy(factor: number) {
  const next = effectiveScale.value * factor;
  scale.value = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
}

function onWheel(e: WheelEvent) {
  if (!e.ctrlKey && !e.metaKey) return;
  e.preventDefault();
  zoomBy(e.deltaY < 0 ? STEP : 1 / STEP);
}
</script>

<template>
  <div class="image-preview absolute inset-0 flex flex-col">
    <div ref="stage" class="stage" @wheel="onWheel">
      <div v-if="failed" class="m-auto text-muted text-sm">{{ t("image.loadFailed") }}</div>
      <img
        v-else
        :key="tab.id"
        :src="tab.imageUrl ?? ''"
        :alt="tab.name"
        class="checker"
        :class="{ pixelated: effectiveScale >= 2 }"
        :style="imgStyle"
        draggable="false"
        @load="onLoad"
        @error="failed = true"
      />
    </div>
    <div v-if="!failed" class="image-toolbar">
      <button type="button" :title="t('image.zoomOut')" @click="zoomBy(1 / STEP)">−</button>
      <span class="pct">{{ Math.round(effectiveScale * 100) }}%</span>
      <button type="button" :title="t('image.zoomIn')" @click="zoomBy(STEP)">+</button>
      <span class="sep" />
      <button type="button" :class="{ on: scale === null }" @click="scale = null">{{ t("image.fit") }}</button>
      <button type="button" :class="{ on: scale === 1 }" @click="scale = 1">{{ t("image.actual") }}</button>
    </div>
  </div>
</template>

<style scoped>
.image-preview {
  background: var(--bg);
}
.stage {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: auto;
}
.stage img {
  /* margin:auto 在 flex 容器里居中，图片超出时仍能完整滚动到边缘 */
  margin: auto;
  flex-shrink: 0;
  user-select: none;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.25);
}
/* 棋盘格底纹：透明区域可见 */
.checker {
  background-color: #fff;
  background-image:
    linear-gradient(45deg, #d9d9d9 25%, transparent 25%),
    linear-gradient(-45deg, #d9d9d9 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #d9d9d9 75%),
    linear-gradient(-45deg, transparent 75%, #d9d9d9 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0;
}
.pixelated {
  image-rendering: pixelated;
}
.image-toolbar {
  position: absolute;
  left: 50%;
  bottom: 14px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: var(--ui-radius, 6px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  font-size: 12px;
  user-select: none;
}
.image-toolbar button {
  min-width: 26px;
  height: 24px;
  padding: 0 8px;
  border: none;
  border-radius: calc(var(--ui-radius, 6px) - 2px);
  background: transparent;
  color: var(--text);
  cursor: pointer;
}
.image-toolbar button:hover {
  background: var(--hover);
}
.image-toolbar button.on {
  color: var(--accent);
  font-weight: 600;
}
.pct {
  min-width: 48px;
  text-align: center;
  color: var(--muted);
}
.sep {
  width: 1px;
  height: 14px;
  margin: 0 4px;
  background: var(--border);
}
</style>
