<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from "vue";
import { t } from "@/i18n";
import {
  findState,
  MATCH_LIMIT,
  onQueryChanged,
  closeFindPanel,
  nextMatch,
  prevMatch,
  replaceOne,
  replaceAll,
  selectAllMatches,
  clearHighlights,
} from "@/find/bridge";

const searchInput = ref<HTMLInputElement | null>(null);
const replaceInput = ref<HTMLInputElement | null>(null);
let updateTimer: number | undefined;

/** 输入变化防抖后重算高亮与计数 */
function scheduleUpdate() {
  if (updateTimer) window.clearTimeout(updateTimer);
  updateTimer = window.setTimeout(() => onQueryChanged(), 120);
}

watch(
  () => [findState.search, findState.caseSensitive, findState.regexp, findState.wholeWord] as const,
  scheduleUpdate
);

watch(
  () => findState.visible,
  (visible) => {
    if (visible) {
      nextTick(() => {
        searchInput.value?.focus();
        searchInput.value?.select();
      });
    }
  }
);

function onSearchKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    closeFindPanel();
  } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && e.altKey) {
    e.preventDefault();
    if (findState.showReplace) replaceAll();
  } else if (e.key === "Enter") {
    e.preventDefault();
    e.shiftKey ? prevMatch() : nextMatch();
  }
}

function onReplaceKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    closeFindPanel();
  } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && e.altKey) {
    e.preventDefault();
    replaceAll();
  } else if (e.key === "Enter") {
    e.preventDefault();
    replaceOne();
  }
}

function onGlobalKeydown(e: KeyboardEvent) {
  if (findState.visible && e.key === "Escape") {
    e.preventDefault();
    closeFindPanel();
  }
}

onMounted(() => window.addEventListener("keydown", onGlobalKeydown));
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onGlobalKeydown);
  if (updateTimer) window.clearTimeout(updateTimer);
});
</script>

<template>
  <Transition name="np-search-pop">
    <div v-if="findState.visible" class="np-search-panel" @mousedown.stop>
      <div class="np-search-row">
        <button
          class="np-search-btn np-search-toggle"
          :title="findState.showReplace ? t('find.collapseReplace') : t('find.expandReplace')"
          @click="findState.showReplace = !findState.showReplace"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" :class="{ 'np-rotated': findState.showReplace }">
            <path d="M6 3.5l5 4.5-5 4.5z" fill="currentColor" />
          </svg>
        </button>

        <div class="np-search-field">
          <input
            ref="searchInput"
            v-model="findState.search"
            type="text"
            autocapitalize="off"
            autocomplete="off"
            autocorrect="off"
            spellcheck="false"
            :placeholder="t('find.searchPlaceholder')"
            @keydown="onSearchKeydown"
          />
          <button
            class="np-search-flag"
            :class="{ active: findState.caseSensitive }"
            :title="t('find.caseSensitive')"
            @click="findState.caseSensitive = !findState.caseSensitive"
          >Aa</button>
          <button
            class="np-search-flag"
            :class="{ active: findState.wholeWord }"
            :title="t('find.wholeWord')"
            @click="findState.wholeWord = !findState.wholeWord"
          >W</button>
          <button
            class="np-search-flag np-search-flag-mono"
            :class="{ active: findState.regexp }"
            :title="t('find.regexpTip')"
            @click="findState.regexp = !findState.regexp"
          >.*</button>
        </div>

        <span
          class="np-search-count"
          :class="{ 'np-search-count-empty': !!findState.search && findState.matchCount === 0 }"
        >
          {{ findState.selectionLimitReached
            ? t("find.selectionLimit", { limit: MATCH_LIMIT, total: findState.matchCount })
            : findState.search && findState.matchCount > 0
              ? `${findState.currentIndex}/${findState.matchCount}`
              : t("find.noResults") }}
        </span>

        <button
          class="np-search-btn"
          :disabled="!findState.search || findState.matchCount === 0"
          :title="t('find.selectAllTip', { limit: MATCH_LIMIT })"
          @click="selectAllMatches"
        >
          <svg viewBox="0 0 16 16" width="15" height="15">
            <path d="M2.5 3h9v1.6h-9zM2.5 7h6v1.6h-6zM2.5 11h9v1.6h-9z" fill="currentColor" />
            <path d="M11.2 6.4l1.1 1.1 2.2-2.4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" transform="translate(-1.1 1)" />
          </svg>
        </button>
        <span v-if="findState.inSelectionScope" class="np-search-scope" :title="t('find.selectionOnly')">
          {{ t("find.selectionOnly") }}
        </span>
        <button class="np-search-btn" :title="t('find.prevTip')" @click="prevMatch">
          <svg viewBox="0 0 16 16" width="14" height="14"><path d="M8 3.5L3.5 8 8 12.5z" fill="currentColor" /></svg>
        </button>
        <button class="np-search-btn" :title="t('find.nextTip')" @click="nextMatch">
          <svg viewBox="0 0 16 16" width="14" height="14"><path d="M8 3.5L12.5 8 8 12.5z" fill="currentColor" /></svg>
        </button>
        <button class="np-search-btn" :title="t('find.close')" @click="closeFindPanel">
          <svg viewBox="0 0 16 16" width="14" height="14">
            <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
          </svg>
        </button>
      </div>

      <div v-if="findState.showReplace" class="np-search-row np-search-replace-row">
        <div class="np-search-spacer"></div>
        <div class="np-search-field np-search-field-replace">
          <input
            ref="replaceInput"
            v-model="findState.replace"
            type="text"
            autocapitalize="off"
            autocomplete="off"
            autocorrect="off"
            spellcheck="false"
            :placeholder="t('find.replacePlaceholder')"
            @keydown="onReplaceKeydown"
          />
        </div>
        <button class="np-search-text-btn" :title="t('find.replace')" @click="replaceOne">{{ t("find.replace") }}</button>
        <button class="np-search-text-btn" :title="t('find.replaceAll')" @click="replaceAll">{{ t("find.replaceAll") }}</button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.np-search-panel {
  position: absolute;
  top: 10px;
  right: 16px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 5px;
  max-width: min(calc(100% - 32px), 640px);
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: var(--ui-radius, 6px);
  background: var(--panel);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
  color: var(--text);
  user-select: none;
}

body.theme-light .np-search-panel {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.np-search-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.np-search-field {
  display: flex;
  align-items: center;
  width: 230px;
  height: 28px;
  border: 1px solid var(--border);
  border-radius: var(--ui-radius, 6px);
  background: var(--bg);
  overflow: hidden;
}

.np-search-field:focus-within {
  border-color: var(--accent);
}

.np-search-field input {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0 8px;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text);
  font-size: 12px;
  font-family: inherit;
  user-select: text;
}

.np-search-field input::placeholder {
  color: var(--muted);
}

.np-search-flag {
  flex: none;
  min-width: 26px;
  height: 20px;
  margin-right: 2px;
  padding: 0 4px;
  border: none;
  border-radius: calc(var(--ui-radius, 6px) - 2px);
  background: transparent;
  color: var(--muted);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

.np-search-flag-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.np-search-flag:hover {
  background: var(--hover);
  color: var(--text);
}

.np-search-flag.active {
  background: var(--accent);
  color: var(--bg);
}

.np-search-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: calc(var(--ui-radius, 6px) - 2px);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
}

.np-search-btn:hover:not(:disabled) {
  background: var(--hover);
  color: var(--text);
}

.np-search-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.np-search-toggle .np-rotated {
  transform: rotate(90deg);
}

.np-search-count {
  min-width: 68px;
  text-align: center;
  color: var(--muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.np-search-count-empty {
  color: var(--danger);
}

.np-search-scope {
  flex: none;
  padding: 2px 6px;
  border-radius: calc(var(--ui-radius, 6px) - 2px);
  background: var(--hover);
  color: var(--muted);
  font-size: 10px;
}

.np-search-spacer {
  flex: none;
  width: 30px;
}

.np-search-text-btn {
  height: 26px;
  padding: 0 9px;
  border: 1px solid var(--border);
  border-radius: calc(var(--ui-radius, 6px) - 2px);
  background: var(--panel-2);
  color: var(--text);
  font-size: 11px;
  white-space: nowrap;
  cursor: pointer;
}

.np-search-text-btn:hover {
  background: var(--hover);
}

.np-search-pop-enter-active,
.np-search-pop-leave-active {
  transition: opacity 0.14s ease, transform 0.14s ease;
}

.np-search-pop-enter-from,
.np-search-pop-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
