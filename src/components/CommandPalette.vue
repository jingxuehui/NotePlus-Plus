<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from "vue";
import { t } from "@/i18n";
import { ui, togglePalette } from "@/stores/ui";
import { paletteCommands, type PaletteCommand } from "@/stores/commands";
import { treeState } from "@/stores/filetree";
import { tabsState } from "@/stores/tabs";
import { openPath } from "@/stores/tabs";
import { getRecent } from "@/stores/recent";
import { convertShortcut, shortcutKeys } from "@/utils/platform";
import type { FileNode } from "@/commands";

function isSymKey(key: string): boolean {
  return /^[⌘⌃⌥⇧]$/.test(key);
}

const query = ref("");
const activeIndex = ref(0);
const inputRef = ref<HTMLInputElement | null>(null);
const listRef = ref<HTMLDivElement | null>(null);

interface FileEntry {
  path: string;
  name: string;
  /** 来源：已打开 / 最近 / 文件树 */
  source: "open" | "recent" | "tree";
}

const allFiles = computed<FileEntry[]>(() => {
  const seen = new Set<string>();
  const out: FileEntry[] = [];
  const add = (path: string, source: FileEntry["source"]) => {
    if (!path || seen.has(path)) return;
    seen.add(path);
    out.push({ path, name: path.split(/[\\/]/).pop() ?? path, source });
  };
  tabsState.tabs.forEach((tab) => {
    if (tab.path) add(tab.path, "open");
  });
  getRecent().forEach((p) => add(p, "recent"));
  const walk = (node: FileNode | null) => {
    if (!node) return;
    if (!node.is_dir) add(node.path, "tree");
    else node.children?.forEach(walk);
  };
  walk(treeState.rootNode);
  return out;
});

/** 子序列模糊匹配：返回分数（越大越匹配），-1 表示不匹配 */
function fuzzyScore(text: string, term: string): number {
  if (!term) return 0;
  const hay = text.toLowerCase();
  const needle = term.toLowerCase();
  let score = 0;
  let ti = 0;
  let streak = 0;
  for (let i = 0; i < hay.length && ti < needle.length; i++) {
    if (hay[i] === needle[ti]) {
      streak += 1;
      score += 10 + streak * 3;
      if (i === 0) score += 15;
      else if (/[\s/\\._-]/.test(hay[i - 1])) score += 8;
      ti += 1;
    } else {
      streak = 0;
    }
  }
  return ti === needle.length ? score - hay.length * 0.1 : -1;
}

interface Scored<T> {
  item: T;
  score: number;
}

function rank<T>(items: T[], text: (item: T) => string, extra: (item: T) => string, term: string): T[] {
  const scored: Scored<T>[] = [];
  for (const item of items) {
    const s = Math.max(fuzzyScore(text(item), term), fuzzyScore(extra(item), term));
    if (s >= 0) scored.push({ item, score: s });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.item);
}

const commandResults = computed<PaletteCommand[]>(() =>
  rank(
    paletteCommands,
    (c) => c.title,
    // 搜索文本同时包含两种平台的快捷键写法，便于按 Ctrl/⌘ 搜索
    (c) => `${c.group} ${c.keywords ?? ""} ${c.shortcut ?? ""} ${c.shortcut ? convertShortcut(c.shortcut) : ""}`,
    query.value.trim()
  )
);

const fileResults = computed<FileEntry[]>(() => {
  const term = query.value.trim();
  return rank(
    allFiles.value,
    (f) => f.name,
    (f) => f.path,
    term
  ).slice(0, 100);
});

const resultCount = computed(() =>
  ui.paletteMode === "command" ? commandResults.value.length : fileResults.value.length
);

watch(query, () => (activeIndex.value = 0));
watch(
  () => ui.paletteMode,
  () => {
    activeIndex.value = 0;
    query.value = "";
    nextTick(() => inputRef.value?.focus());
  }
);

function close() {
  togglePalette(undefined, false);
}

async function activate(index: number) {
  if (ui.paletteMode === "command") {
    const cmd = commandResults.value[index];
    if (!cmd) return;
    close();
    await cmd.run();
  } else {
    const file = fileResults.value[index];
    if (!file) return;
    close();
    await openPath(file.path);
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    close();
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    activeIndex.value = Math.min(activeIndex.value + 1, resultCount.value - 1);
    scrollActiveIntoView();
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    activeIndex.value = Math.max(activeIndex.value - 1, 0);
    scrollActiveIntoView();
  } else if (e.key === "Enter") {
    e.preventDefault();
    void activate(activeIndex.value);
  } else if (e.key === "Tab" && !e.shiftKey) {
    e.preventDefault();
    togglePalette(ui.paletteMode === "command" ? "file" : "command", true);
  }
}

function scrollActiveIntoView() {
  nextTick(() => {
    const el = listRef.value?.querySelector<HTMLElement>(".palette-item.active");
    el?.scrollIntoView({ block: "nearest" });
  });
}

onMounted(() => {
  window.addEventListener("keydown", onKeydown, true);
  nextTick(() => inputRef.value?.focus());
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown, true);
});
</script>

<template>
  <Teleport to="body">
    <div class="palette-overlay" @click.self="close">
      <div class="palette-window">
        <div class="palette-input-row">
          <span class="palette-mode-tag">{{ ui.paletteMode === "command" ? t("palette.modeCommand") : t("palette.modeFile") }}</span>
          <input
            ref="inputRef"
            v-model="query"
            type="text"
            spellcheck="false"
            autocomplete="off"
            :placeholder="ui.paletteMode === 'command' ? t('palette.placeholderCommand') : t('palette.placeholderFile')"
          />
          <span class="palette-hint">{{ t("palette.hint") }}</span>
        </div>

        <div ref="listRef" class="palette-list">
          <template v-if="ui.paletteMode === 'command'">
            <div v-for="(cmd, idx) in commandResults" :key="cmd.id" class="palette-item" :class="{ active: idx === activeIndex }" @mouseenter="activeIndex = idx" @click="activate(idx)">
              <div class="palette-item-main">
                <span class="palette-item-title">{{ cmd.title }}</span>
                <span class="palette-item-group">{{ cmd.group }}</span>
              </div>
              <span v-if="cmd.shortcut" class="palette-item-shortcut" :title="convertShortcut(cmd.shortcut)">
                <template v-for="(group, gi) in shortcutKeys(cmd.shortcut)" :key="gi">
                  <span v-if="gi > 0" class="sc-group-sep">/</span>
                  <template v-for="(key, ki) in group" :key="ki">
                    <span v-if="ki > 0" class="sc-sep">+</span>
                    <kbd class="sc-key" :class="{ sym: isSymKey(key), shift: key === '⇧' }">{{ key }}</kbd>
                  </template>
                </template>
              </span>
            </div>
          </template>
          <template v-else>
            <div v-for="(file, idx) in fileResults" :key="file.path" class="palette-item" :class="{ active: idx === activeIndex }" @mouseenter="activeIndex = idx" @click="activate(idx)">
              <div class="palette-item-main">
                <span class="palette-item-title">{{ file.name }}</span>
                <span class="palette-item-path">{{ file.path }}</span>
              </div>
              <span class="palette-item-source">{{ file.source === "open" ? t("palette.sourceOpen") : file.source === "recent" ? t("palette.sourceRecent") : t("palette.sourceTree") }}</span>
            </div>
          </template>

          <div v-if="resultCount === 0" class="palette-empty">{{ t("palette.noResults") }}</div>
        </div>

        <div class="palette-footer">
          <span>↑↓ {{ t("palette.navigate") }}</span>
          <span>↵ {{ t("palette.select") }}</span>
          <span>Esc {{ t("palette.close") }}</span>
          <span>Tab {{ t("palette.switchMode") }}</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.palette-overlay {
  position: fixed;
  inset: 0;
  z-index: 85;
  display: flex;
  justify-content: center;
  padding-top: max(80px, calc((100vh - 520px) / 2));
  background: rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(3px);
}

.palette-window {
  width: min(640px, 92vw);
  max-height: min(520px, 80vh);
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: calc(var(--ui-radius, 6px) + 4px);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55);
  overflow: hidden;
  animation: palette-pop 0.14s ease-out;
}

.palette-input-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  height: 48px;
  border-bottom: 1px solid var(--border);
  flex: none;
}

.palette-mode-tag {
  flex: none;
  padding: 3px 8px;
  border-radius: calc(var(--ui-radius, 6px) - 2px);
  background: var(--accent-tint, var(--hover));
  color: var(--accent);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.palette-input-row input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text);
  font-size: 14px;
  font-family: inherit;
  user-select: text;
}

.palette-input-row input::placeholder {
  color: var(--muted);
}

.palette-hint {
  flex: none;
  color: var(--muted);
  font-size: 11px;
  white-space: nowrap;
}

.palette-list {
  flex: 1;
  min-height: 120px;
  overflow-y: auto;
  padding: 6px;
}

.palette-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px;
  border-radius: var(--ui-radius, 6px);
  cursor: pointer;
}

.palette-item.active {
  background: var(--hover);
}

.palette-item-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.palette-item-title {
  color: var(--text);
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.palette-item-group,
.palette-item-path {
  color: var(--muted);
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.palette-item-shortcut,
.palette-item-source {
  flex: none;
  color: var(--muted);
  font-size: 11px;
}

/* 快捷键按分段的键帽显示：[⌘] + [N]，Windows 下为 [Ctrl] + [N] */
.palette-item-shortcut {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
}

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

.sc-key.sym {
  font-size: 14px;
}

.sc-key.sym.shift {
  transform: translateY(-1px);
}

.sc-sep,
.sc-group-sep {
  color: var(--muted);
  font-size: 10px;
}

.palette-empty {
  padding: 30px 10px;
  text-align: center;
  color: var(--muted);
  font-size: 12px;
}

.palette-footer {
  display: flex;
  gap: 16px;
  padding: 8px 14px;
  border-top: 1px solid var(--border);
  color: var(--muted);
  font-size: 11px;
  flex: none;
}

@keyframes palette-pop {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
