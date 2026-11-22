<script setup lang="ts">
import { tabsState, setActive } from "@/stores/tabs";

const emit = defineEmits<{ close: [id: number] }>();

function onAuxClick(id: number, e: MouseEvent) {
  if (e.button === 1) emit("close", id);
}
</script>

<template>
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
  background: var(--accent-tint);
}
</style>
