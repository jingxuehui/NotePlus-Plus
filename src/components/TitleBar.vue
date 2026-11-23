<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { settings, cycleTheme } from "@/stores/settings";
import { ui, toggleSettings } from "@/stores/ui";
import { openFindWindow } from "@/find/bridge";
import { activeTab, saveTabAs, closeOtherTabs, closeAllTabs } from "@/stores/tabs";
import { revealInFinder } from "@/commands";
import { formatJsonDocument } from "@/editor/format";
import ShortcutHint from "./ShortcutHint.vue";
import ThemeIcon from "./ThemeIcon.vue";

const emit = defineEmits<{
  new: [];
  open: [];
  "open-folder": [];
  save: [];
  "save-all": [];
  "close-active": [];
}>();

const moreOpen = ref(false);
const moreWrap = ref<HTMLElement | null>(null);

function onDocClick(e: MouseEvent) {
  if (moreOpen.value && moreWrap.value && !moreWrap.value.contains(e.target as Node)) {
    moreOpen.value = false;
  }
}
function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") moreOpen.value = false;
}
onMounted(() => {
  document.addEventListener("mousedown", onDocClick);
  window.addEventListener("keydown", onKey);
});
onBeforeUnmount(() => {
  document.removeEventListener("mousedown", onDocClick);
  window.removeEventListener("keydown", onKey);
});

function runMore(action: () => void) {
  action();
  moreOpen.value = false;
}
</script>

<template>
  <!-- 自绘标题栏：红绿灯由系统绘制在左侧，工具栏按钮与标题同一行 -->
  <div class="titlebar" data-tauri-drag-region>
    <!-- 红绿灯 + 系统原生标题占用的区域，标题由系统绘制，避免重复 -->
    <div class="traffic-light-space" data-tauri-drag-region>
      <span class="app-title" data-tauri-drag-region>NotePlus+</span>
    </div>

    <div class="toolbar">
      <span
        v-if="settings.toolbar.sidebar"
        class="icon-btn"
        :class="{ active: settings.sidebarVisible }"
        title="侧边栏 (⌘B)"
        @click="settings.sidebarVisible = !settings.sidebarVisible"
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
          <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
          <line x1="6" y1="2.5" x2="6" y2="13.5" />
        </svg>
      </span>
      <span v-if="settings.toolbar.newFile" class="icon-btn" title="新建文件 (⌘N)" @click="emit('new')">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
          <path d="M9 1.5H4a1.5 1.5 0 0 0-1.5 1.5v10A1.5 1.5 0 0 0 4 14.5h8A1.5 1.5 0 0 0 13.5 13V6L9 1.5z" />
          <path d="M9 1.5V6h4.5" />
          <line x1="8" y1="8.5" x2="8" y2="12" /><line x1="6.2" y1="10.2" x2="9.8" y2="10.2" />
        </svg>
      </span>
      <span v-if="settings.toolbar.openFile" class="icon-btn" title="打开文件 (⌘O)" @click="emit('open')">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
          <path d="M1.5 4.5A1.5 1.5 0 0 1 3 3h3l1.5 1.5H13A1.5 1.5 0 0 1 14.5 6v6A1.5 1.5 0 0 1 13 13.5H3A1.5 1.5 0 0 1 1.5 12v-7.5z" />
        </svg>
      </span>
      <span v-if="settings.toolbar.openFolder" class="icon-btn" title="打开文件夹 (⇧⌘O)" @click="emit('open-folder')">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
          <path d="M1.5 3.5A1.5 1.5 0 0 1 3 2h3.2l1.3 1.5H13A1.5 1.5 0 0 1 14.5 5v1H4.2a1.5 1.5 0 0 0-1.4 1l-1.3 4V3.5z" />
          <path d="M1.9 12.7 3.4 8.6a1 1 0 0 1 .94-.66h9.66a1 1 0 0 1 .94 1.34l-1.3 3.72a1.4 1.4 0 0 1-1.32.94H3.2a1.4 1.4 0 0 1-1.3-1.3z" />
        </svg>
      </span>
      <span
        v-if="(settings.toolbar.newFile || settings.toolbar.openFile || settings.toolbar.openFolder) && (settings.toolbar.save || settings.toolbar.saveAll)"
        class="w-px h-4 bg-[var(--border)] mx-1"
      ></span>
      <span v-if="settings.toolbar.save" class="icon-btn" title="保存 (⌘S)" @click="emit('save')">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
          <path d="M12.5 13.5h-9A1.5 1.5 0 0 1 2 12V4a1.5 1.5 0 0 1 1.5-1.5h7L13.5 5.5V12a1.5 1.5 0 0 1-1 1.4z" />
          <path d="M5 2.5v3h5v-3" /><rect x="5" y="9" width="6" height="4.5" />
        </svg>
      </span>
      <span v-if="settings.toolbar.saveAll" class="icon-btn" title="全部保存 (⌥⌘S)" @click="emit('save-all')">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
          <path d="M10.5 1.5h-6A1.5 1.5 0 0 0 3 3v8a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 13 11V4l-2.5-2.5z" />
          <path d="M5 12.5v2a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V6" />
        </svg>
      </span>
      <span
        v-if="(settings.toolbar.save || settings.toolbar.saveAll) && (settings.toolbar.find || settings.toolbar.format)"
        class="w-px h-4 bg-[var(--border)] mx-1"
      ></span>
      <span v-if="settings.toolbar.find" class="icon-btn" title="查找和替换 (⌘F)" @click="openFindWindow()">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
          <circle cx="7" cy="7" r="4.5" />
          <line x1="10.5" y1="10.5" x2="14" y2="14" />
        </svg>
      </span>
      <span
        v-if="settings.toolbar.format"
        class="icon-btn"
        :class="{ disabled: !activeTab }"
        title="格式化 JSON (⇧⌥F)"
        @click="activeTab && formatJsonDocument()"
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
          <path d="M6.2 2.2c-1.5 0-2.1.9-2.1 2.4v1.5c0 1-.5 1.7-1.4 1.9.9.2 1.4.9 1.4 1.9v1.5c0 1.5.6 2.4 2.1 2.4" />
          <path d="M9.8 2.2c1.5 0 2.1.9 2.1 2.4v1.5c0 1 .5 1.7 1.4 1.9-.9.2-1.4.9-1.4 1.9v1.5c0 1.5-.6 2.4-2.1 2.4" />
          <line x1="8" y1="5.4" x2="8" y2="10.6" stroke-dasharray="1 1.6" />
        </svg>
      </span>
    </div>

    <!-- 更多操作：设置中隐藏的主操作仍可在这里访问 -->
    <div ref="moreWrap" class="more-wrap">
      <button class="more-trigger" :class="{ active: moreOpen }" title="更多操作" @click="moreOpen = !moreOpen">
        更多
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.3">
          <path d="M2 4l3 3 3-3" />
        </svg>
      </button>
      <div v-if="moreOpen" class="more-menu">
        <button v-if="settings.toolbar.saveAs" @click="runMore(() => activeTab && saveTabAs(activeTab))">另存为</button>
        <button v-if="settings.toolbar.reveal" :disabled="!activeTab?.path" @click="runMore(() => activeTab?.path && revealInFinder(activeTab.path))">在 Finder 中显示</button>
        <button v-if="settings.toolbar.closeTab" :disabled="!activeTab" @click="runMore(() => emit('close-active'))">关闭当前标签</button>
        <button v-if="settings.toolbar.closeOthers" :disabled="!activeTab" @click="runMore(() => activeTab && closeOtherTabs(activeTab.id))">关闭其他标签</button>
        <button v-if="settings.toolbar.closeAll" @click="runMore(() => closeAllTabs())">关闭全部标签</button>
      </div>
    </div>

    <div class="titlebar-fill" data-tauri-drag-region></div>

    <!-- 快捷键提示 -->
    <ShortcutHint v-if="settings.toolbar.shortcutHint" />

    <!-- 右上角主题切换：点击按 亮色 / 暗色 / 跟随系统 循环 -->
    <span
      v-if="settings.toolbar.themeToggle"
      class="icon-btn theme-toggle"
      title="主题"
      @click="cycleTheme"
    >
      <ThemeIcon :key="settings.themeChoice" class="theme-icon-anim" :mode="settings.themeChoice" :size="17" />
    </span>

    <!-- 右上角设置入口（与其他工具栏按钮一致的透明样式） -->
    <span
      v-if="settings.toolbar.systemSettings"
      class="settings-trigger"
      :class="{ active: ui.showSettings }"
      title="设置 (⌘,)"
      @click="toggleSettings()"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
        <rect x="8.6" y="2.6" width="6.8" height="18.8" rx="3.4" />
        <rect x="8.6" y="2.6" width="6.8" height="18.8" rx="3.4" transform="rotate(60 12 12)" />
        <rect x="8.6" y="2.6" width="6.8" height="18.8" rx="3.4" transform="rotate(120 12 12)" />
        <circle cx="12" cy="12" r="3.2" />
      </svg>
    </span>
  </div>
</template>

<style scoped>
.titlebar {
  display: flex;
  align-items: center;
  height: 36px;
  flex-shrink: 0;
  padding-right: 10px;
  background: var(--panel);
  border-bottom: 1px solid var(--border);
  user-select: none;
}
.traffic-light-space {
  /* 红绿灯占位 + 自绘标题（系统标题已用 hiddenTitle 隐藏，避免浅色主题下白字消失） */
  width: 180px;
  flex-shrink: 0;
  align-self: stretch;
  display: flex;
  align-items: center;
  padding-left: 86px;
  pointer-events: none;
}
.app-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  opacity: 0.92;
  letter-spacing: 0.01em;
  white-space: nowrap;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 0.5px;
  flex-shrink: 0;
}
.titlebar-fill {
  flex: 1;
  align-self: stretch;
}
.icon-btn.disabled {
  opacity: 0.35;
  pointer-events: none;
}
.more-wrap {
  position: relative;
  flex-shrink: 0;
}
.more-trigger {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 8px;
  border-radius: 6px;
  color: var(--muted);
  font-size: 12px;
  cursor: pointer;
}
.more-trigger:hover,
.more-trigger.active {
  background: var(--hover);
  color: var(--text);
}
.more-menu {
  position: absolute;
  top: 30px;
  left: 0;
  z-index: 80;
  min-width: 170px;
  padding: 4px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
}
.more-menu button {
  display: block;
  width: 100%;
  height: 30px;
  padding: 0 10px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--text);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.more-menu button:hover:not(:disabled) { background: var(--hover); }
.more-menu button:disabled { opacity: 0.4; cursor: default; }
.icon-btn.theme-toggle {
  padding: 0;
  border: none;
  background: transparent;
}
.theme-icon-anim {
  animation: theme-icon-in 260ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes theme-icon-in {
  0% {
    opacity: 0;
    transform: rotate(-18deg) scale(0.72);
  }
  100% {
    opacity: 1;
    transform: rotate(0) scale(1);
  }
}
.settings-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  margin-left: 2px;
  border-radius: 6px;
  color: var(--muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
}
.settings-trigger:hover {
  background: var(--hover);
  color: var(--text);
}
.settings-trigger.active {
  color: var(--accent);
}
</style>
