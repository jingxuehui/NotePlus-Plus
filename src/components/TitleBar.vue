<script setup lang="ts">
import { settings } from "@/stores/settings";
import { ui, toggleSettings } from "@/stores/ui";
import { openFindWindow } from "@/find/bridge";
import { activeTab } from "@/stores/tabs";
import { formatJsonDocument } from "@/editor/format";

const emit = defineEmits<{
  new: [];
  open: [];
  "open-folder": [];
  save: [];
  "save-all": [];
}>();
</script>

<template>
  <!-- 自绘标题栏：红绿灯由系统绘制在左侧，工具栏按钮与标题同一行 -->
  <div class="titlebar" data-tauri-drag-region>
    <!-- 红绿灯 + 系统原生标题占用的区域，标题由系统绘制，避免重复 -->
    <div class="traffic-light-space" data-tauri-drag-region></div>

    <div class="toolbar">
      <span
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
      <span class="icon-btn" title="新建文件 (⌘N)" @click="emit('new')">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
          <path d="M9 1.5H4a1.5 1.5 0 0 0-1.5 1.5v10A1.5 1.5 0 0 0 4 14.5h8A1.5 1.5 0 0 0 13.5 13V6L9 1.5z" />
          <path d="M9 1.5V6h4.5" />
          <line x1="8" y1="8.5" x2="8" y2="12" /><line x1="6.2" y1="10.2" x2="9.8" y2="10.2" />
        </svg>
      </span>
      <span class="icon-btn" title="打开文件 (⌘O)" @click="emit('open')">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
          <path d="M1.5 4.5A1.5 1.5 0 0 1 3 3h3l1.5 1.5H13A1.5 1.5 0 0 1 14.5 6v6A1.5 1.5 0 0 1 13 13.5H3A1.5 1.5 0 0 1 1.5 12v-7.5z" />
        </svg>
      </span>
      <span class="icon-btn" title="打开文件夹 (⇧⌘O)" @click="emit('open-folder')">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
          <path d="M1.5 3.5A1.5 1.5 0 0 1 3 2h3.2l1.3 1.5H13A1.5 1.5 0 0 1 14.5 5v1H4.2a1.5 1.5 0 0 0-1.4 1l-1.3 4V3.5z" />
          <path d="M1.9 12.7 3.4 8.6a1 1 0 0 1 .94-.66h9.66a1 1 0 0 1 .94 1.34l-1.3 3.72a1.4 1.4 0 0 1-1.32.94H3.2a1.4 1.4 0 0 1-1.3-1.3z" />
        </svg>
      </span>
      <span class="w-px h-4 bg-[var(--border)] mx-1"></span>
      <span class="icon-btn" title="保存 (⌘S)" @click="emit('save')">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
          <path d="M12.5 13.5h-9A1.5 1.5 0 0 1 2 12V4a1.5 1.5 0 0 1 1.5-1.5h7L13.5 5.5V12a1.5 1.5 0 0 1-1 1.4z" />
          <path d="M5 2.5v3h5v-3" /><rect x="5" y="9" width="6" height="4.5" />
        </svg>
      </span>
      <span class="icon-btn" title="全部保存 (⌥⌘S)" @click="emit('save-all')">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
          <path d="M10.5 1.5h-6A1.5 1.5 0 0 0 3 3v8a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 13 11V4l-2.5-2.5z" />
          <path d="M5 12.5v2a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V6" />
        </svg>
      </span>
      <span class="w-px h-4 bg-[var(--border)] mx-1"></span>
      <span class="icon-btn" title="查找和替换 (⌘F)" @click="openFindWindow()">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
          <circle cx="7" cy="7" r="4.5" />
          <line x1="10.5" y1="10.5" x2="14" y2="14" />
        </svg>
      </span>
      <span
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

    <div class="titlebar-fill" data-tauri-drag-region></div>

    <!-- 右上角设置入口 -->
    <span
      class="settings-trigger"
      :class="{ active: ui.showSettings }"
      title="设置 (⌘,)"
      @click="toggleSettings()"
    >
      <span class="settings-icon-box">
        <svg width="16" height="16" viewBox="0 0 24 24">
          <g fill="none" stroke="#a8c7ff" stroke-width="2.4">
            <rect x="8.6" y="2.6" width="6.8" height="18.8" rx="3.4" />
            <rect x="8.6" y="2.6" width="6.8" height="18.8" rx="3.4" transform="rotate(60 12 12)" />
            <rect x="8.6" y="2.6" width="6.8" height="18.8" rx="3.4" transform="rotate(120 12 12)" />
          </g>
          <circle cx="12" cy="12" r="3.2" fill="#3c4a63" />
        </svg>
      </span>
      <span class="settings-dot"></span>
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
  /* 红绿灯 + 系统原生标题「NotePlus+」，再留 30pt 间距给工具栏 */
  width: 180px;
  flex-shrink: 0;
  align-self: stretch;
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
.settings-trigger {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 26px;
  height: 32px;
  cursor: pointer;
  flex-shrink: 0;
}
.settings-icon-box {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 23px;
  height: 23px;
  border-radius: 7px;
  background: #3c4a63;
  transition: background 0.15s, box-shadow 0.15s;
}
.settings-trigger:hover .settings-icon-box {
  background: #46587a;
}
.settings-trigger.active .settings-icon-box {
  box-shadow: 0 0 0 2px var(--accent);
}
.settings-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #6f86ab;
}
.settings-trigger.active .settings-dot {
  background: var(--accent);
  box-shadow: 0 0 5px var(--accent);
}
</style>
