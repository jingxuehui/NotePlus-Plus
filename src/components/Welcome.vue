<script setup lang="ts">
import { ref } from "vue";
import { getRecent, clearRecent } from "@/stores/recent";
import { SHORTCUTS } from "@/data/shortcuts";
import type { Shortcut } from "@/data/shortcuts";
import { t } from "@/i18n";
import { baseName } from "@/utils/path";
import { isMac, shortcutKeys } from "@/utils/platform";

const emit = defineEmits<{
  open: [];
  "open-folder": [];
  "open-path": [path: string];
}>();

const recent = ref(getRecent());

function clearAll() {
  clearRecent();
  recent.value = [];
}

// 快捷键列表与标题栏的快捷键提示共用同一份数据
const shortcuts = SHORTCUTS;

function isSymKey(key: string): boolean {
  return /^[⌘⌃⌥⇧]$/.test(key);
}

/** 把当前平台的快捷键拆成键帽序列：外层为 " / " 分隔的多组，内层为每组的每个键 */
function keysFor(s: Shortcut): string[][] {
  const raw = isMac ? s.k : (s.kw ?? s.k);
  return isMac
    ? shortcutKeys(raw)
    : raw.split(" / ").map((part) => part.split("+"));
}
</script>

<template>
  <div class="absolute inset-0 flex items-center justify-center overflow-auto">
    <div class="text-center select-none">
      <div class="text-[42px] font-bold tracking-wide mb-1">
        Note<span class="accent">Plus</span><span class="accent">+</span>
      </div>
      <p class="text-xs text-muted mb-8">{{ t("welcome.tagline") }}</p>

      <div class="flex items-center justify-center gap-3 mb-10">
        <button class="np-btn primary" @click="emit('open')">{{ t("welcome.openFile") }}</button>
        <button class="np-btn" @click="emit('open-folder')">{{ t("welcome.openFolder") }}</button>
      </div>

      <div class="shortcut-list text-left">
        <div v-for="s in shortcuts" :key="s.k" class="row">
          <span class="k" :title="s.keyLabel ? t(s.keyLabel) : (isMac ? s.k : (s.kw ?? s.k))">
            <template v-if="s.keyLabel">
              <kbd class="sc-key wide">{{ t(s.keyLabel) }}</kbd>
            </template>
            <template v-else>
              <template v-for="(group, gi) in keysFor(s)" :key="gi">
                <span v-if="gi > 0" class="sc-group-sep">/</span>
                <template v-for="(key, ki) in group" :key="ki">
                  <span v-if="ki > 0" class="sc-sep">+</span>
                  <kbd class="sc-key" :class="{ sym: isSymKey(key), shift: key === '⇧' }">{{ key }}</kbd>
                </template>
              </template>
            </template>
          </span>
          <span class="desc">{{ t(s.label) }}</span>
        </div>
      </div>

      <div v-if="recent.length" class="mt-10 text-left">
        <div class="flex items-center gap-2 mb-2">
          <span class="text-xs text-muted">{{ t("welcome.recent") }}</span>
          <span class="text-xs accent cursor-pointer" @click="clearAll">{{ t("welcome.clear") }}</span>
        </div>
        <div
          v-for="p in recent.slice(0, 8)"
          :key="p"
          class="recent-row text-muted"
          :title="p"
          @click="emit('open-path', p)"
        >
          {{ baseName(p) }}
          <span class="path text-xs opacity-60">{{ p }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 网格布局：键帽列宽度由最长组合决定，说明列自动对齐，整体水平居中 */
.shortcut-list {
  display: inline-grid;
  grid-template-columns: max-content max-content;
  column-gap: 14px;
  row-gap: 6px;
  align-items: center;
  margin: 0 auto;
}
/* 让每行的两个 span 直接参与网格布局 */
.row {
  display: contents;
}
.k {
  display: inline-flex;
  align-items: center;
  justify-self: end;
  gap: 3px;
  height: 20px;
  white-space: nowrap;
  font-family: "SF Mono", Menlo, monospace;
}
.desc {
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
}
/* 与命令面板一致的独立键帽：[⌘] + [N] */
.sc-key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  box-sizing: border-box;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: calc(var(--ui-radius, 6px) - 2px);
  font-family: "SF Mono", Menlo, monospace;
  font-size: 11px;
  line-height: 1;
  color: var(--text);
}
.sc-key.wide {
  padding: 0 8px;
}
/* 修饰符符号在等宽字体里偏小，放大后与字母视觉等大 */
.sc-key.sym {
  font-size: 14px;
}
/* ⇧ 字形基线偏低，单独上移 */
.sc-key.sym.shift {
  transform: translateY(-1px);
}
.sc-sep,
.sc-group-sep {
  color: var(--muted);
  font-size: 10px;
}
.recent-row {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 26px;
  font-size: 12px;
  cursor: pointer;
  border-radius: var(--ui-radius, 6px);
  padding: 0 8px;
  max-width: 420px;
  overflow: hidden;
  white-space: nowrap;
}
.recent-row:hover {
  background: var(--hover);
  color: var(--text);
}
.path {
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
