<script setup lang="ts">
import { computed } from "vue";
import type { FileNode } from "@/commands";
import { toggleExpand, treeState } from "@/stores/filetree";
import { tabsState, activeTab, openPath } from "@/stores/tabs";

const props = defineProps<{ node: FileNode; depth: number }>();

const isExpanded = computed(() => treeState.expanded.has(props.node.path));
const isOpenInTab = computed(() =>
  tabsState.tabs.some((t) => t.path === props.node.path)
);
const isActive = computed(() => activeTab.value?.path === props.node.path);

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function onClick() {
  if (props.node.is_dir) {
    toggleExpand(props.node);
  } else {
    openPath(props.node.path);
  }
}
</script>

<template>
  <div>
    <div
      class="tree-row"
      :class="{ active: isActive, opened: isOpenInTab && !isActive }"
      :style="{ paddingLeft: depth * 14 + 8 + 'px' }"
      @click="onClick"
      :title="node.path"
    >
      <span class="chevron" :class="{ expanded: isExpanded }" v-if="node.is_dir">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
          <path d="M3 1.5 7 5 3 8.5z" />
        </svg>
      </span>
      <span class="icon" v-else></span>
      <svg v-if="node.is_dir" class="node-icon" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
        <path d="M1.5 4A1.5 1.5 0 0 1 3 2.5h3l1.5 1.5H13A1.5 1.5 0 0 1 14.5 5.5v6A1.5 1.5 0 0 1 13 13H3A1.5 1.5 0 0 1 1.5 11.5V4z" />
      </svg>
      <svg v-else class="node-icon" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
        <path d="M9.5 1.5H4A1.5 1.5 0 0 0 2.5 3v10A1.5 1.5 0 0 0 4 14.5h8A1.5 1.5 0 0 0 13.5 13V5.5l-4-4z" />
        <path d="M9.5 1.5v4h4" />
      </svg>
      <span class="name">{{ node.name }}</span>
      <span class="size" v-if="!node.is_dir && node.size != null && node.size < 1024 * 512">
        {{ formatSize(node.size) }}
      </span>
    </div>
    <div v-if="node.is_dir && isExpanded && node.children && node.children.length">
      <TreeItem v-for="child in node.children" :key="child.path" :node="child" :depth="depth + 1" />
    </div>
    <div
      v-else-if="node.is_dir && isExpanded && (!node.children || node.children.length === 0)"
      class="empty-dir text-muted"
      :style="{ paddingLeft: (depth + 1) * 14 + 28 + 'px' }"
    >
      空文件夹
    </div>
  </div>
</template>

<style scoped>
.tree-row {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding-right: 8px;
  cursor: pointer;
  color: var(--muted);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  transition: background 0.1s;
}
.tree-row:hover {
  background: var(--hover);
}
.tree-row.active {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  color: var(--text);
}
.tree-row.opened {
  color: var(--accent);
}
.chevron {
  display: inline-flex;
  width: 12px;
  flex-shrink: 0;
  transition: transform 0.12s;
  color: var(--muted);
}
.chevron.expanded {
  transform: rotate(90deg);
}
.icon {
  width: 12px;
  flex-shrink: 0;
}
.node-icon {
  flex-shrink: 0;
}
.name {
  overflow: hidden;
  text-overflow: ellipsis;
}
.size {
  margin-left: auto;
  font-size: 10px;
  color: var(--muted);
  opacity: 0.7;
}
.empty-dir {
  font-size: 11px;
  height: 22px;
  display: flex;
  align-items: center;
}
</style>
