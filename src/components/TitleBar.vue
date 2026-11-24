<script setup lang="ts">
import { computed } from "vue";
import { settings, cycleTheme } from "@/stores/settings";
import { ui, toggleSettings, toggleUpdateCenter } from "@/stores/ui";
import { updater } from "@/stores/updater";
import { openFindWindow } from "@/find/bridge";
import { activeTab } from "@/stores/tabs";
import { openExternal } from "@/commands";
import { formatJsonDocument } from "@/editor/format";
import ShortcutHint from "./ShortcutHint.vue";
import ThemeIcon from "./ThemeIcon.vue";

const REPO_LINKS = {
  github: "https://github.com/jingxuehui/NotePlus-Plus",
  gitee: "https://gitee.com/jingxuehui/NotePlus-Plus",
};

function openRepo(url: string) {
  openExternal(url).catch((e) => console.error("打开仓库链接失败", e));
}

/** 按设置中的拖拽顺序排列标题栏按钮 */
function orderOf(key: string): number {
  const i = settings.toolbarOrder.indexOf(key);
  return i < 0 ? 90 : i;
}

const { hasUpdate, isDownloaded, updateVersion } = updater;

/** dbx 风格：有更新时按钮变成带文字的操作按钮，否则保持安静的图标按钮 */
const updateTitle = computed(() => {
  if (isDownloaded.value) return `v${updateVersion.value} 已下载，重启即可更新`;
  if (hasUpdate.value) return `发现新版本 ${updateVersion.value}`;
  return "检查更新";
});

async function onUpdateClick() {
  if (isDownloaded.value) {
    await updater.install();
    return;
  }
  toggleUpdateCenter(true);
  void updater.refreshManually();
}

const emit = defineEmits<{
  new: [];
  open: [];
  "open-folder": [];
  save: [];
  "save-as": [];
  "save-all": [];
}>();
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
        :style="{ order: orderOf('sidebar') }"
        title="侧边栏 (⌘B)"
        @click="settings.sidebarVisible = !settings.sidebarVisible"
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
          <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
          <line x1="6" y1="2.5" x2="6" y2="13.5" />
        </svg>
      </span>
      <span v-if="settings.toolbar.newFile" class="icon-btn" :style="{ order: orderOf('newFile') }" title="新建文件 (⌘N)" @click="emit('new')">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
          <path d="M9 1.5H4a1.5 1.5 0 0 0-1.5 1.5v10A1.5 1.5 0 0 0 4 14.5h8A1.5 1.5 0 0 0 13.5 13V6L9 1.5z" />
          <path d="M9 1.5V6h4.5" />
          <line x1="8" y1="8.5" x2="8" y2="12" /><line x1="6.2" y1="10.2" x2="9.8" y2="10.2" />
        </svg>
      </span>
      <span v-if="settings.toolbar.openFile" class="icon-btn" :style="{ order: orderOf('openFile') }" title="打开文件 (⌘O)" @click="emit('open')">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
          <path d="M1.5 4.5A1.5 1.5 0 0 1 3 3h3l1.5 1.5H13A1.5 1.5 0 0 1 14.5 6v6A1.5 1.5 0 0 1 13 13.5H3A1.5 1.5 0 0 1 1.5 12v-7.5z" />
        </svg>
      </span>
      <span v-if="settings.toolbar.openFolder" class="icon-btn" :style="{ order: orderOf('openFolder') }" title="打开文件夹 (⇧⌘O)" @click="emit('open-folder')">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
          <path d="M1.5 3.5A1.5 1.5 0 0 1 3 2h3.2l1.3 1.5H13A1.5 1.5 0 0 1 14.5 5v1H4.2a1.5 1.5 0 0 0-1.4 1l-1.3 4V3.5z" />
          <path d="M1.9 12.7 3.4 8.6a1 1 0 0 1 .94-.66h9.66a1 1 0 0 1 .94 1.34l-1.3 3.72a1.4 1.4 0 0 1-1.32.94H3.2a1.4 1.4 0 0 1-1.3-1.3z" />
        </svg>
      </span>
      <span
        v-if="settings.toolbar.save"
        class="icon-btn"
        :class="{ 'sep-before': settings.toolbar.sidebar || settings.toolbar.newFile || settings.toolbar.openFile || settings.toolbar.openFolder }"
        :style="{ order: orderOf('save') }"
        title="保存 (⌘S)"
        @click="emit('save')"
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
          <path d="M12.5 13.5h-9A1.5 1.5 0 0 1 2 12V4a1.5 1.5 0 0 1 1.5-1.5h7L13.5 5.5V12a1.5 1.5 0 0 1-1 1.4z" />
          <path d="M5 2.5v3h5v-3" /><rect x="5" y="9" width="6" height="4.5" />
        </svg>
      </span>
      <span
        v-if="settings.toolbar.saveAs"
        class="icon-btn"
        :class="{ disabled: !activeTab }"
        :style="{ order: orderOf('saveAs') }"
        title="另存为 (⇧⌘S)"
        @click="emit('save-as')"
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
          <path d="M10.5 1.5h-6A1.5 1.5 0 0 0 3 3v8a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 13 11V4l-2.5-2.5z" />
          <path d="M5 12.5v2a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V6" />
          <path d="M8 6.5v3.5M6.25 8.25h3.5" />
        </svg>
      </span>
      <span v-if="settings.toolbar.saveAll" class="icon-btn" :style="{ order: orderOf('saveAll') }" title="全部保存 (⌥⌘S)" @click="emit('save-all')">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
          <path d="M10.5 1.5h-6A1.5 1.5 0 0 0 3 3v8a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 13 11V4l-2.5-2.5z" />
          <path d="M5 12.5v2a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V6" />
        </svg>
      </span>
      <span
        v-if="settings.toolbar.find"
        class="icon-btn"
        :class="{ 'sep-before': settings.toolbar.save || settings.toolbar.saveAs || settings.toolbar.saveAll }"
        :style="{ order: orderOf('find') }"
        title="查找和替换 (⌘F)"
        @click="openFindWindow()"
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
          <circle cx="7" cy="7" r="4.5" />
          <line x1="10.5" y1="10.5" x2="14" y2="14" />
        </svg>
      </span>
      <span
        v-if="settings.toolbar.format"
        class="icon-btn"
        :class="{ disabled: !activeTab }"
        :style="{ order: orderOf('format') }"
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

    <div class="titlebar-fill" data-tauri-drag-region></div>

    <!-- 更新中心入口 -->
    <span
      v-if="settings.toolbar.updateButton"
      class="update-trigger"
      :class="{ 'has-update': hasUpdate }"
      :style="{ order: orderOf('updateButton') }"
      :title="updateTitle"
      @click="onUpdateClick"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" />
        <path d="M12 13v8" /><path d="m8 17 4 4 4-4" />
      </svg>
      <span v-if="hasUpdate">更新</span>
    </span>

    <!-- 仓库快捷入口：GitHub / Gitee -->
    <span
      v-if="settings.toolbar.github"
      class="icon-btn repo-link"
      :style="{ order: orderOf('github') }"
      title="GitHub 仓库"
      @click="openRepo(REPO_LINKS.github)"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 .3a12 12 0 0 0-3.79 23.4c.6.1.82-.26.82-.58v-2.04c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.81 5.63-5.48 5.93.43.37.82 1.1.82 2.22v3.29c0 .32.22.69.83.57A12 12 0 0 0 12 .3z" />
      </svg>
    </span>
    <span
      v-if="settings.toolbar.gitee"
      class="icon-btn repo-link gitee"
      :style="{ order: orderOf('gitee') }"
      title="Gitee 仓库"
      @click="openRepo(REPO_LINKS.gitee)"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M20.5 11.6a8.5 8.5 0 1 0-2.6 6.1" />
        <path d="M20.5 11.6v6.1h-6.1" />
      </svg>
    </span>

    <!-- 右上角主题切换：点击按 亮色 / 暗色 / 跟随系统 循环 -->
    <span
      v-if="settings.toolbar.themeToggle"
      class="icon-btn theme-toggle"
      :style="{ order: orderOf('themeToggle') }"
      title="主题"
      @click="cycleTheme"
    >
      <ThemeIcon :key="settings.themeChoice" class="theme-icon-anim" :mode="settings.themeChoice" :size="17" />
    </span>

    <!-- 快捷键提示（紧邻设置入口左侧） -->
    <ShortcutHint v-if="settings.toolbar.shortcutHint" :style="{ order: orderOf('shortcutHint') }" />

    <!-- 右上角设置入口（与其他工具栏按钮一致的透明样式） -->
    <span
      v-if="settings.toolbar.systemSettings"
      class="settings-trigger"
      :class="{ active: ui.showSettings }"
      :style="{ order: orderOf('systemSettings') }"
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
/* 分组分隔线：跟随目标按钮左侧，不参与 order 排序 */
.icon-btn.sep-before {
  position: relative;
}
.icon-btn.sep-before::before {
  content: "";
  position: absolute;
  left: -3px;
  top: 5px;
  bottom: 5px;
  width: 1px;
  background: var(--border);
}
.update-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--text);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  flex-shrink: 0;
}
.update-trigger:hover { background: var(--hover); }
.update-trigger.has-update {
  width: auto;
  padding: 0 10px;
  border-color: var(--accent);
  background: var(--accent);
  /* 文字取面板底色：暗色主题用深色、亮色主题用白色，自动适配各种强调色 */
  color: var(--panel);
}
.update-trigger.has-update:hover { background: var(--accent); filter: brightness(1.12); }
.repo-link.gitee {
  color: #d8573f;
}
.repo-link.gitee:hover {
  color: #e8624a;
}
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
