<script setup lang="ts">
import { tabsState, activeTab, setActive } from "@/stores/tabs";
import { settings } from "@/stores/settings";
import { ui, toggleSettings } from "@/stores/ui";
import { openFindWindow } from "@/find/bridge";
import SettingsPanel from "./SettingsPanel.vue";

const emit = defineEmits<{
  close: [id: number];
  new: [];
  open: [];
  "open-folder": [];
  save: [];
  "save-all": [];
}>();

function onAuxClick(id: number, e: MouseEvent) {
  if (e.button === 1) emit("close", id);
}
</script>

<template>
  <!-- 工具栏 -->
  <div class="flex items-center h-9 px-2 gap-0.5 bg-panel border-b border-line shrink-0">
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

    <!-- 右上角设置入口：蓝色圆角方块 + 齿轮 + 激活圆点 -->
    <span class="flex-1"></span>
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

  <!-- 设置弹框 -->
  <SettingsPanel v-if="ui.showSettings" />

  <!-- 标签页 -->
  <div class="tab-strip flex h-9 bg-panel2 border-b border-line overflow-x-auto shrink-0">
    <div
      v-for="tab in tabsState.tabs"
      :key="tab.id"
      class="tab-item"
      :class="{ active: tab.id === tabsState.activeId }"
      :title="tab.path ?? tab.name"
      @click="setActive(tab.id)"
      @auxclick="onAuxClick(tab.id, $event)"
    >
      <span class="dirty-dot" v-if="tab.dirty"></span>
      <span class="tab-file-icon" v-else>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
          <path d="M9 1.5H4a1.5 1.5 0 0 0-1.5 1.5v10A1.5 1.5 0 0 0 4 14.5h8A1.5 1.5 0 0 0 13.5 13V6L9 1.5z" />
          <path d="M9 1.5V6h4.5" />
        </svg>
      </span>
      <span class="tab-name">{{ tab.name }}</span>
      <span class="close-btn" title="关闭 (⌘W)" @click.stop="emit('close', tab.id)">
        <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" stroke-width="1.4">
          <line x1="1" y1="1" x2="9" y2="9" /><line x1="9" y1="1" x2="1" y2="9" />
        </svg>
      </span>
    </div>
  </div>
</template>

<style scoped>
.settings-trigger {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 26px;
  height: 32px;
  margin-right: 4px;
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

.tab-item {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 100%;
  padding: 0 8px 0 12px;
  max-width: 200px;
  border-right: 1px solid var(--border);
  color: var(--muted);
  cursor: pointer;
  font-size: 12px;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
}
.tab-item:hover {
  background: var(--hover);
}
.tab-item.active {
  background: var(--panel);
  color: var(--text);
  box-shadow: inset 0 -2px 0 var(--accent);
}
.tab-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dirty-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
}
.close-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 4px;
  opacity: 0;
  flex-shrink: 0;
}
.tab-item:hover .close-btn {
  opacity: 0.7;
}
.close-btn:hover {
  opacity: 1 !important;
  background: var(--hover);
}

/* 文件图标：仅现代分窗显示（经典紧凑沿用未保存小圆点） */
.tab-file-icon {
  display: none;
  align-items: center;
  flex-shrink: 0;
}

/* ===== 现代分窗：标签变为独立圆角胶囊 ===== */
body.layout-modern .tab-strip {
  padding: 5px 8px;
  gap: 6px;
  background: transparent;
  scrollbar-width: none;
}
body.layout-modern .tab-strip::-webkit-scrollbar {
  height: 0;
}
body.layout-modern .tab-item {
  align-self: center;
  height: 26px;
  border: 1px solid transparent;
  border-radius: 10px;
  padding: 0 8px 0 10px;
  background: var(--panel-2);
  color: var(--muted);
  box-shadow: none;
}
body.layout-modern .tab-item:hover {
  background: var(--hover);
}
body.layout-modern .tab-item.active {
  background: var(--accent-tint);
  border-color: var(--accent-edge);
  color: var(--text);
  box-shadow: none;
}
body.layout-modern .tab-file-icon {
  display: inline-flex;
  color: var(--accent);
}
body.layout-modern .close-btn {
  opacity: 0.6;
}
body.layout-modern .tab-item:hover .close-btn {
  opacity: 0.9;
}
body.layout-modern .close-btn:hover {
  background: color-mix(in srgb, var(--accent) 22%, transparent);
}
</style>
