<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from "vue";
import { activeTab, cursorInfo } from "@/stores/tabs";
import { t } from "@/i18n";
import { formatBytes } from "@/utils/image";
import { unfoldAllLines } from "@/editor/selection";
import { EditorSelection } from "@codemirror/state";
import { viewRef } from "@/editor/view";
import { LANGUAGE_OPTIONS, languageNameByKey } from "@/editor/language";
import { updateLanguageOverride } from "@/editor/setup";

function clearMultiCursor() {
  const view = viewRef.current;
  if (!view) return;
  const head = view.state.selection.main.head;
  view.dispatch({ selection: EditorSelection.cursor(head) });
  view.focus();
}

const emit = defineEmits<{ "close-tab": [id: number] }>();

const langLabel = computed(() => activeTab.value?.language ?? t("common.plainText"));

const eolLabel = computed(() => {
  switch (activeTab.value?.eol) {
    case "CRLF": return "CRLF";
    case "CR": return "CR";
    case "MIXED": return t("status.eolMixed");
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

// 保存编码：与 Rust 侧 read/write_text_file 支持的标签保持一致
const ENCODING_GROUPS: { title: string; items: { value: string; label: string }[] }[] = [
  {
    title: "Unicode",
    items: [
      { value: "UTF-8", label: "UTF-8" },
      { value: "UTF-8 BOM", label: "UTF-8 BOM" },
      { value: "UTF-16LE", label: "UTF-16 LE" },
      { value: "UTF-16BE", label: "UTF-16 BE" },
    ],
  },
  {
    title: "status.encZh",
    items: [
      { value: "GBK", label: "status.encGbk" },
      { value: "Big5", label: "status.encBig5" },
    ],
  },
  {
    title: "status.encJa",
    items: [
      { value: "Shift_JIS", label: "Shift_JIS" },
      { value: "EUC-JP", label: "EUC-JP" },
    ],
  },
  {
    title: "status.encWest",
    items: [{ value: "Windows-1252", label: "Windows-1252" }],
  },
];

const encodingOpen = ref(false);
const encodingWrap = ref<HTMLElement | null>(null);

const langOpen = ref(false);
const langWrap = ref<HTMLElement | null>(null);

/** 语言菜单选项：纯文本（无语法高亮）+ 支持的语法列表 */
const langChoices = computed(() => [
  { key: null as string | null, name: t("common.plainText") },
  ...LANGUAGE_OPTIONS.map((o) => ({ key: o.key as string | null, name: o.name })),
]);

function onDocClick(e: MouseEvent) {
  if (encodingOpen.value && encodingWrap.value && !encodingWrap.value.contains(e.target as Node)) {
    encodingOpen.value = false;
  }
  if (langOpen.value && langWrap.value && !langWrap.value.contains(e.target as Node)) {
    langOpen.value = false;
  }
}

function selectEncoding(value: string) {
  const tab = activeTab.value;
  if (tab && tab.encoding !== value) {
    tab.encoding = value;
    tab.dirty = true;
  }
  encodingOpen.value = false;
}

/** 状态栏手动切换语言：null = 纯文本（关闭语法高亮）；覆盖按扩展名推断的结果，切标签后保持 */
function selectLanguage(key: string | null) {
  const tab = activeTab.value;
  if (!tab || tab.kind !== "text") return;
  langOpen.value = false;
  if (tab.languageOverride === key) return;
  tab.languageOverride = key;
  tab.language = key ? languageNameByKey(key) : t("common.plainText");
  const view = viewRef.current;
  if (view) void updateLanguageOverride(view, key);
}

onMounted(() => document.addEventListener("click", onDocClick, true));
onBeforeUnmount(() => document.removeEventListener("click", onDocClick, true));
</script>

<template>
  <div class="status-bar flex items-center h-6 px-3 gap-4 bg-panel border-t border-line text-xs text-muted shrink-0 select-none">
    <span class="truncate flex-1" :title="activeTab?.path ?? ''">
      {{ activeTab ? (activeTab.path ?? activeTab.name) : t("common.ready") }}
    </span>
    <template v-if="activeTab?.kind === 'image'">
      <span v-if="activeTab.imageWidth">{{ activeTab.imageWidth }} × {{ activeTab.imageHeight }}</span>
      <span>{{ formatBytes(activeTab.imageBytes) }}</span>
      <span>{{ langLabel }}</span>
    </template>
    <template v-else-if="activeTab">
      <span>{{ t("status.lineCol", { line: cursorInfo.line, col: cursorInfo.col }) }}</span>
      <span v-if="cursorInfo.selected > 0">{{ t("status.selected", { n: cursorInfo.selected }) }}</span>
      <span v-if="cursorInfo.cursors > 1" class="clickable fallback-indicator" :title="t('status.cursorsTip')" @click="clearMultiCursor">
        {{ t("status.cursors", { n: cursorInfo.cursors }) }}
      </span>
      <span v-if="cursorInfo.folded > 0" class="clickable fallback-indicator" :title="t('status.foldedTip')" @click="unfoldAllLines">
        {{ t("status.folded", { n: cursorInfo.folded }) }}
      </span>
      <span>{{ t("status.lines", { n: cursorInfo.lines }) }}</span>
      <span>{{ t("status.chars", { n: cursorInfo.chars }) }}</span>
      <span class="clickable" :title="t('status.eolTip')" @click="cycleEol">{{ eolLabel }}</span>
      <div class="encoding-select" ref="encodingWrap">
        <span class="clickable encoding-trigger" :title="t('status.encodingTip')" @click="encodingOpen = !encodingOpen">
          {{ activeTab.encoding }}
        </span>
        <div class="encoding-menu" v-if="encodingOpen">
          <div class="encoding-hint">{{ t("status.saveAsEncoding") }}</div>
          <div v-for="g in ENCODING_GROUPS" :key="g.title" class="encoding-group">
            <div class="encoding-group-title">{{ t(g.title) }}</div>
            <button
              v-for="o in g.items"
              :key="o.value"
              type="button"
              :class="{ on: activeTab.encoding === o.value }"
              @click="selectEncoding(o.value)"
            >
              <span>{{ t(o.label) }}</span>
              <span class="encoding-check" v-if="activeTab.encoding === o.value">✓</span>
            </button>
          </div>
        </div>
      </div>
      <div class="encoding-select" ref="langWrap">
        <span class="clickable encoding-trigger" :title="t('status.langTip')" @click="langOpen = !langOpen">
          {{ langLabel }}
        </span>
        <div class="encoding-menu lang-menu" v-if="langOpen">
          <button
            v-for="o in langChoices"
            :key="o.key ?? 'plain'"
            type="button"
            :class="{ on: activeTab.languageOverride === o.key }"
            @click="selectLanguage(o.key)"
          >
            <span>{{ o.name }}</span>
            <span class="encoding-check" v-if="activeTab.languageOverride === o.key">✓</span>
          </button>
        </div>
      </div>
      <span class="dirty-indicator" :class="{ on: activeTab.dirty }">
        {{ activeTab.dirty ? t("status.dirty") : "" }}
      </span>
    </template>
  </div>
</template>

<style scoped>
.clickable {
  cursor: pointer;
  border-radius: calc(var(--ui-radius, 6px) - 3px);
  padding: 0 4px;
  transition: background 0.1s, color 0.1s;
}
.clickable:hover {
  background: var(--hover);
  color: var(--text);
}
.fallback-indicator {
  color: var(--accent);
}
.fallback-indicator:hover {
  background: var(--accent-tint, var(--hover));
}
.dirty-indicator {
  display: inline-block;
  min-width: 52px;
  text-align: right;
}
.dirty-indicator.on {
  color: var(--accent);
}

/* 编码下拉：状态栏在窗口底部，菜单向上展开 */
.encoding-select {
  position: relative;
  flex-shrink: 0;
}
.encoding-trigger {
  display: inline-block;
  min-width: 68px;
  text-align: center;
}
.encoding-menu {
  position: absolute;
  bottom: calc(100% + 8px);
  right: 0;
  z-index: 40;
  width: 208px;
  padding: 6px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: var(--ui-radius, 6px);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
}
.encoding-hint {
  padding: 2px 8px 6px;
  font-size: 11px;
  color: var(--muted);
}
.encoding-group + .encoding-group {
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid var(--border);
}
.encoding-group-title {
  padding: 3px 8px;
  font-size: 10px;
  color: var(--muted);
  opacity: 0.8;
}
.encoding-menu > .encoding-group > button {
  width: 100%;
  height: 26px;
  padding: 0 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  border-radius: calc(var(--ui-radius, 6px) - 2px);
  background: transparent;
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
  text-align: left;
}
.encoding-menu > .encoding-group > button:hover {
  background: var(--hover);
}
.encoding-menu > .encoding-group > button.on {
  color: var(--accent);
  font-weight: 600;
}
.encoding-check {
  margin-left: auto;
  font-size: 11px;
}

/* 语言菜单：平铺按钮列表 + 上限高度可滚动（选项多于编码菜单） */
.lang-menu {
  max-height: 280px;
  overflow-y: auto;
}
.lang-menu > button {
  width: 100%;
  height: 24px;
  padding: 0 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  border-radius: calc(var(--ui-radius, 6px) - 2px);
  background: transparent;
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
  text-align: left;
}
.lang-menu > button:hover {
  background: var(--hover);
}
.lang-menu > button.on {
  color: var(--accent);
  font-weight: 600;
}
</style>
