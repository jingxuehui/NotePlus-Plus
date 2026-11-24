<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from "vue";
import { emitTo, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

const search = ref("");
const replaceText = ref("");
const ignoreCase = ref(true);
const regexp = ref(false);
const selectionOnly = ref(false);
const matchCount = ref(0);

const searchInput = ref<HTMLInputElement | null>(null);
const replaceInput = ref<HTMLInputElement | null>(null);

const historyOpen = ref<"" | "search" | "replace">("");
const menuOpen = ref(false);
const showCheat = ref(false);

function loadHistory(kind: string): string[] {
  try {
    const raw = localStorage.getItem(`noteplus.${kind}History`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(kind: string, list: string[]) {
  localStorage.setItem(`noteplus.${kind}History`, JSON.stringify(list.slice(0, 10)));
}

const searchHistory = ref<string[]>(loadHistory("find"));
const replaceHistory = ref<string[]>(loadHistory("replace"));

function pushHistory(kind: "find" | "replace", value: string) {
  if (!value.trim()) return;
  const target = kind === "find" ? searchHistory : replaceHistory;
  const list = target.value.filter((v) => v !== value);
  list.unshift(value);
  target.value = list.slice(0, 10);
  saveHistory(kind, list);
}

let debounce: number | undefined;

function emitQuery() {
  if (debounce) window.clearTimeout(debounce);
  debounce = window.setTimeout(() => {
    emitTo("main", "find:query", {
      search: search.value,
      replace: replaceText.value,
      caseSensitive: !ignoreCase.value,
      regexp: regexp.value,
    }).catch(() => undefined);
  }, 100);
}

watch([search, replaceText, ignoreCase, regexp], emitQuery);

function action(name: string) {
  emitTo("main", "find:action", name).catch(() => undefined);
}

function next() {
  if (!search.value) return;
  pushHistory("find", search.value);
  action("next");
}

function prev() {
  if (!search.value) return;
  pushHistory("find", search.value);
  action("prev");
}

function replaceOne() {
  if (!search.value) return;
  pushHistory("replace", replaceText.value);
  action("replace");
}

function replaceEverything() {
  if (!search.value) return;
  pushHistory("replace", replaceText.value);
  action("replaceAll");
}

function findAll() {
  menuOpen.value = false;
  if (!search.value) return;
  pushHistory("find", search.value);
  action("findAll");
}

function clearHighlights() {
  menuOpen.value = false;
  action("clearHighlights");
}

function toggleSelectionOnly() {
  selectionOnly.value = !selectionOnly.value;
  if (selectionOnly.value) {
    emitTo("main", "find:selection-request", null).catch(() => undefined);
  }
}

type AccentPayload = {
  accent: string;
  tint: string;
  edge: string;
  selection: string;
};

function applyTheme(theme: string, colors?: AccentPayload) {
  document.body.classList.toggle("theme-light", theme === "light");
  // 独立窗口不会执行主窗口的 applyVisual，需显式同步完整强调色变量
  if (colors) {
    const target = document.body.style;
    target.setProperty("--accent", colors.accent);
    target.setProperty("--accent-tint", colors.tint);
    target.setProperty("--accent-edge", colors.edge);
    target.setProperty("--selection-bg", colors.selection);
  }
}

function onSearchKeydown(e: KeyboardEvent) {
  if (e.key === "Enter") {
    e.preventDefault();
    e.shiftKey ? prev() : next();
    historyOpen.value = "";
  } else if (e.key === "Escape") {
    closeWindow();
  }
}

function onReplaceKeydown(e: KeyboardEvent) {
  if (e.key === "Enter") {
    e.preventDefault();
    replaceOne();
  } else if (e.key === "Escape") {
    closeWindow();
  }
}

function closeWindow() {
  invoke("close_find_window").catch(() => {
    getCurrentWindow().close().catch(() => undefined);
  });
}

const unlisteners: UnlistenFn[] = [];

onMounted(async () => {
  unlisteners.push(
    await listen<{ count: number }>("find:count", (e) => {
      matchCount.value = e.payload.count;
    })
  );
  unlisteners.push(
    await listen<{
      selection: string;
      theme: string;
      accent?: AccentPayload;
      query: { search: string; replace: string; caseSensitive: boolean; regexp: boolean };
    }>("find:state", (e) => {
      const { selection, theme, accent, query } = e.payload;
      applyTheme(theme, accent);
      if (!search.value && selection) {
        search.value = selection;
        selectionOnly.value = true;
      } else if (!search.value && query?.search) {
        search.value = query.search;
        replaceText.value = query.replace;
        ignoreCase.value = !query.caseSensitive;
        regexp.value = query.regexp;
      }
    })
  );
  unlisteners.push(
    await listen<{ theme: string; accent?: AccentPayload }>("find:theme", (e) =>
      applyTheme(e.payload.theme, e.payload.accent)
    )
  );
  unlisteners.push(
    await listen<{ text: string }>("find:selection", (e) => {
      if (e.payload.text) {
        search.value = e.payload.text;
        searchInput.value?.select();
      }
    })
  );
  unlisteners.push(
    await listen("find:focus", () => {
      searchInput.value?.focus();
      searchInput.value?.select();
    })
  );

  // Esc 全局关闭（无论焦点在输入框还是其他位置）
  window.addEventListener("keydown", onGlobalKeydown);

  await emitTo("main", "find:init", null).catch(() => undefined);
  searchInput.value?.focus();
});

function onGlobalKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    closeWindow();
  }
}

onBeforeUnmount(() => {
  unlisteners.forEach((fn) => fn());
  window.removeEventListener("keydown", onGlobalKeydown);
});

function closeMenus() {
  historyOpen.value = "";
  menuOpen.value = false;
  showCheat.value = false;
}
</script>

<template>
  <div class="find-dialog" @click="closeMenus">
    <!-- 查找输入 -->
    <div class="field">
      <span class="prefix">
        <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8">
          <circle cx="7.8" cy="7.8" r="5" />
          <line x1="11.6" y1="11.6" x2="15.5" y2="15.5" stroke-linecap="round" />
        </svg>
      </span>
      <span class="chev" @click.stop="historyOpen = historyOpen === 'search' ? '' : 'search'">
        <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor">
          <path d="M1.5 3.5 5 7l3.5-3.5z" />
        </svg>
      </span>
      <input
        ref="searchInput"
        v-model="search"
        class="field-input"
        placeholder="查找"
        spellcheck="false"
        @keydown="onSearchKeydown"
      />
      <div v-if="historyOpen === 'search'" class="history" @click.stop>
        <div
          v-for="h in searchHistory"
          :key="h"
          class="history-item"
          @click="search = h; historyOpen = ''; searchInput?.focus()"
        >
          {{ h }}
        </div>
        <div v-if="!searchHistory.length" class="history-empty">暂无历史记录</div>
      </div>
    </div>

    <!-- 替换输入 -->
    <div class="field">
      <span class="prefix">
        <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M12.2 2.8l3 3L6 15H3v-3l9.2-9.2z" stroke-linejoin="round" />
        </svg>
      </span>
      <span class="chev" @click.stop="historyOpen = historyOpen === 'replace' ? '' : 'replace'">
        <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor">
          <path d="M1.5 3.5 5 7l3.5-3.5z" />
        </svg>
      </span>
      <input
        ref="replaceInput"
        v-model="replaceText"
        class="field-input"
        placeholder="替换"
        spellcheck="false"
        @keydown="onReplaceKeydown"
      />
      <div v-if="historyOpen === 'replace'" class="history" @click.stop>
        <div
          v-for="h in replaceHistory"
          :key="h"
          class="history-item"
          @click="replaceText = h; historyOpen = ''; replaceInput?.focus()"
        >
          {{ h }}
        </div>
        <div v-if="!replaceHistory.length" class="history-empty">暂无历史记录</div>
      </div>
    </div>

    <!-- 选项 -->
    <div class="options">
      <button class="chip" :class="{ on: regexp }" @click.stop="regexp = !regexp">
        <span class="check" :class="{ checked: regexp }"></span>
        正则表达式
        <span class="q" title="支持 JS 正则语法，例如 \d+ 、(foo|bar)、^start">?</span>
      </button>
      <button class="chip" :class="{ on: ignoreCase }" @click.stop="ignoreCase = !ignoreCase">
        <span class="check" :class="{ checked: ignoreCase }"></span>
        忽略大小写
      </button>
      <button class="chip" :class="{ on: selectionOnly }" @click.stop="toggleSelectionOnly">
        <span class="check" :class="{ checked: selectionOnly }"></span>
        所选内容
      </button>
      <button class="round" :class="{ on: showCheat }" title="常用正则速查" @click.stop="showCheat = !showCheat">
        <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="9" cy="9" r="7" />
          <path d="M6.8 7a2.2 2.2 0 1 1 2.9 2.1c-.5.2-.7.6-.7 1.1v.3" stroke-linecap="round" />
          <circle cx="9" cy="12.8" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      </button>
    </div>

    <!-- 正则速查 -->
    <div v-if="showCheat" class="cheat" @click.stop>
      <div class="cheat-title">常用正则</div>
      <div
        class="cheat-row"
        v-for="r in [
          ['\\d+', '数字'],
          ['\\w+', '单词字符'],
          ['(foo|bar)', '或匹配'],
          ['^text', '行首'],
          ['text$', '行尾'],
          ['\\s+', '空白字符'],
        ]"
        :key="r[0]"
      >
        <code>{{ r[0] }}</code><span>{{ r[1] }}</span>
      </div>
    </div>

    <!-- 底部操作 -->
    <div class="footer">
      <span class="count">
        {{ search ? (matchCount > 0 ? `${matchCount} 个匹配` : "无匹配") : "" }}
      </span>

      <div class="split-btn" @click="findAll">
        <span>全部查找</span>
        <span class="caret" @click.stop="menuOpen = !menuOpen">
          <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor">
            <path d="M1.5 3.5 5 7l3.5-3.5z" />
          </svg>
        </span>
        <div v-if="menuOpen" class="menu" @click.stop>
          <div class="menu-item" @click="findAll">全部查找</div>
          <div class="menu-item" @click="clearHighlights">清除查找高亮</div>
        </div>
      </div>

      <button class="btn" @click.stop="replaceEverything">全部替换</button>
      <button class="btn" @click.stop="replaceOne">替换</button>

      <button class="nav" title="上一个 (Shift+Enter)" @click.stop="prev">
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M8.5 2.5 4 7l4.5 4.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <button class="nav" title="下一个 (Enter)" @click.stop="next">
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M5.5 2.5 10 7l-4.5 4.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.find-dialog {
  --find-accent: var(--accent);
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--panel);
  position: relative;
  overflow: hidden;
}

.field {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 42px;
  padding: 0 10px;
  background: var(--panel-2);
  border: 2px solid transparent;
  border-radius: 10px;
  transition: border-color 0.12s, background 0.12s;
}
.field:focus-within {
  border-color: var(--find-accent);
}
.prefix {
  display: flex;
  color: var(--muted);
  flex-shrink: 0;
}
.chev {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 100%;
  color: var(--muted);
  cursor: pointer;
  flex-shrink: 0;
}
.chev:hover {
  color: var(--text);
}
.field-input {
  flex: 1;
  height: 100%;
  background: transparent;
  border: none;
  outline: none;
  font-size: 13px;
  color: var(--text);
  caret-color: var(--find-accent);
  user-select: text;
  min-width: 0;
}
.field-input::placeholder {
  color: color-mix(in srgb, var(--muted) 80%, transparent);
}

.history {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 4px;
  z-index: 20;
  max-height: 120px;
  overflow: auto;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
}
.history-item {
  padding: 5px 8px;
  border-radius: 5px;
  font-size: 12px;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.history-item:hover {
  background: var(--hover);
}
.history-empty {
  padding: 6px 8px;
  font-size: 11px;
  color: var(--muted);
}

.options {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
  overflow: hidden;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 24px;
  padding: 0 8px;
  border-radius: 7px;
  background: var(--panel-2);
  color: var(--text);
  font-size: 11px;
  cursor: pointer;
  border: none;
  white-space: nowrap;
  transition: background 0.12s;
  flex-shrink: 0;
}
.chip:hover {
  background: var(--hover);
}
.check {
  width: 11px;
  height: 11px;
  border-radius: 3px;
  border: 1.5px solid var(--muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.check.checked {
  background: var(--find-accent);
  border-color: var(--find-accent);
}
.check.checked::after {
  content: "";
  width: 6px;
  height: 3px;
  border-left: 2px solid var(--panel);
  border-bottom: 2px solid var(--panel);
  transform: rotate(-45deg) translateY(-1px);
}
.q {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid var(--muted);
  color: var(--muted);
  font-size: 9px;
  cursor: help;
}
.round {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--panel-2);
  color: var(--text);
  border: none;
  cursor: pointer;
  flex-shrink: 0;
}
.round:hover,
.round.on {
  background: var(--hover);
  color: var(--find-accent);
}

.cheat {
  position: absolute;
  right: 12px;
  bottom: 48px;
  width: 200px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  z-index: 30;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4);
}
.cheat-title {
  font-size: 10px;
  color: var(--muted);
  margin-bottom: 4px;
}
.cheat-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 10.5px;
  color: var(--muted);
  height: 18px;
  align-items: center;
}
.cheat-row code {
  color: var(--find-accent);
  font-family: "SF Mono", Menlo, monospace;
}

.footer {
  margin-top: auto;
  display: flex;
  align-items: center;
  gap: 5px;
  position: relative;
}
.count {
  font-size: 10.5px;
  color: var(--muted);
  margin-right: auto;
  white-space: nowrap;
  min-width: 44px;
}
.btn,
.split-btn,
.nav {
  height: 28px;
  border: none;
  border-radius: 7px;
  background: var(--panel-2);
  color: var(--text);
  font-size: 11.5px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s;
  flex-shrink: 0;
}
.btn {
  padding: 0 9px;
}
.btn:hover,
.split-btn:hover,
.nav:hover {
  background: var(--hover);
}
.split-btn {
  padding: 0 2px 0 9px;
  gap: 3px;
  position: relative;
}
.caret {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 22px;
  border-radius: 5px;
  color: var(--muted);
}
.caret:hover {
  color: var(--text);
}
.menu {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 0;
  min-width: 118px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 7px;
  padding: 4px;
  z-index: 20;
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.4);
}
.menu-item {
  padding: 6px 8px;
  border-radius: 5px;
  font-size: 11.5px;
  white-space: nowrap;
}
.menu-item:hover {
  background: var(--hover);
}
.nav {
  width: 28px;
}
</style>
