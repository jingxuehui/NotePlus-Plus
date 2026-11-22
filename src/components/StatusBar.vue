<script setup lang="ts">
import { computed } from "vue";
import { activeTab, cursorInfo } from "@/stores/tabs";

const emit = defineEmits<{ "close-tab": [id: number] }>();

const langLabel = computed(() => activeTab.value?.language ?? "纯文本");

const eolLabel = computed(() => {
  switch (activeTab.value?.eol) {
    case "CRLF": return "CRLF";
    case "CR": return "CR";
    case "MIXED": return "混合";
    default: return "LF";
  }
});

function cycleEol() {
  const tab = activeTab.value;
  if (!tab) return;
  const order = ["LF", "CRLF", "CR"];
  const idx = order.indexOf(tab.eol === "MIXED" ? "LF" : tab.eol);
  tab.eol = order[(idx + 1) % order.length];
  tab.dirty = true;
}

function cycleEncoding() {
  const tab = activeTab.value;
  if (!tab) return;
  tab.encoding = tab.encoding === "UTF-8" ? "UTF-8 BOM" : "UTF-8";
  tab.dirty = true;
}
</script>

<template>
  <div class="status-bar flex items-center h-6 px-3 gap-4 bg-panel border-t border-line text-xs text-muted shrink-0 select-none">
    <span class="truncate flex-1" :title="activeTab?.path ?? ''">
      {{ activeTab ? (activeTab.path ?? activeTab.name) : "就绪" }}
    </span>
    <template v-if="activeTab">
      <span>行 {{ cursorInfo.line }}，列 {{ cursorInfo.col }}</span>
      <span v-if="cursorInfo.selected > 0">已选 {{ cursorInfo.selected }}</span>
      <span>{{ cursorInfo.lines }} 行</span>
      <span>{{ cursorInfo.chars }} 字符</span>
      <span class="clickable" title="点击切换换行符" @click="cycleEol">{{ eolLabel }}</span>
      <span class="clickable" title="点击切换 UTF-8 / UTF-8 BOM" @click="cycleEncoding">
        {{ activeTab.encoding }}
      </span>
      <span>{{ langLabel }}</span>
      <span v-if="activeTab.dirty" class="text-[var(--accent)]">未保存</span>
    </template>
  </div>
</template>

<style scoped>
.clickable {
  cursor: pointer;
  border-radius: 3px;
  padding: 0 4px;
  transition: background 0.1s, color 0.1s;
}
.clickable:hover {
  background: var(--hover);
  color: var(--text);
}
</style>
