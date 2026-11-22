<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from "vue";
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
    title: "中文",
    items: [
      { value: "GBK", label: "GBK · 简体中文" },
      { value: "Big5", label: "Big5 · 繁体中文" },
    ],
  },
  {
    title: "日文",
    items: [
      { value: "Shift_JIS", label: "Shift_JIS" },
      { value: "EUC-JP", label: "EUC-JP" },
    ],
  },
  {
    title: "西欧",
    items: [{ value: "Windows-1252", label: "Windows-1252" }],
  },
];

const encodingOpen = ref(false);
const encodingWrap = ref<HTMLElement | null>(null);

function onDocClick(e: MouseEvent) {
  if (encodingOpen.value && encodingWrap.value && !encodingWrap.value.contains(e.target as Node)) {
    encodingOpen.value = false;
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

onMounted(() => document.addEventListener("click", onDocClick, true));
onBeforeUnmount(() => document.removeEventListener("click", onDocClick, true));
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
      <div class="encoding-select" ref="encodingWrap">
        <span class="clickable encoding-trigger" title="选择文件编码" @click="encodingOpen = !encodingOpen">
          {{ activeTab.encoding }}
        </span>
        <div class="encoding-menu" v-if="encodingOpen">
          <div class="encoding-hint">以编码保存</div>
          <div v-for="g in ENCODING_GROUPS" :key="g.title" class="encoding-group">
            <div class="encoding-group-title">{{ g.title }}</div>
            <button
              v-for="o in g.items"
              :key="o.value"
              type="button"
              :class="{ on: activeTab.encoding === o.value }"
              @click="selectEncoding(o.value)"
            >
              <span>{{ o.label }}</span>
              <span class="encoding-check" v-if="activeTab.encoding === o.value">✓</span>
            </button>
          </div>
        </div>
      </div>
      <span>{{ langLabel }}</span>
      <span class="dirty-indicator" :class="{ on: activeTab.dirty }">
        {{ activeTab.dirty ? "未保存" : "" }}
      </span>
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
</style>
