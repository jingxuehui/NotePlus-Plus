<script setup lang="ts">
import { treeState, refresh, setShowHidden } from "@/stores/filetree";
import { openFolderWithDialog } from "@/stores/tabs";
import { loadRoot } from "@/stores/filetree";
import { notify } from "@/stores/toast";
import { t } from "@/i18n";
import TreeItem from "./TreeItem.vue";

const emit = defineEmits<{ "close-folder": [] }>();

async function pickFolder() {
  const dir = await openFolderWithDialog();
  if (!dir) return;
  try {
    await loadRoot(dir);
  } catch (e) {
    notify(typeof e === "string" ? e : String(e));
  }
}
</script>

<template>
  <div class="sidebar-pane w-60 flex flex-col border-r border-line shrink-0 min-h-0">
    <div class="flex items-center h-9 px-3 gap-1 border-b border-line shrink-0">
      <span class="text-xs font-semibold truncate flex-1" :title="treeState.root ?? ''">
        {{ treeState.rootName || t("tree.explorer") }}
      </span>
      <span class="icon-btn" v-if="treeState.root" :title="t('tree.refresh')" @click="refresh">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
          <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" />
          <path d="M13.6 1.8v3h-3" />
        </svg>
      </span>
      <span
        class="icon-btn"
        :class="{ active: treeState.showHidden }"
        :title="t('tree.showHidden')"
        @click="setShowHidden(!treeState.showHidden)"
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
          <circle cx="8" cy="3" r="1.2" fill="currentColor" />
          <path d="M2.5 3h4M9.5 3h4" />
          <circle cx="8" cy="8" r="1.2" fill="currentColor" />
          <path d="M2.5 8h4M9.5 8h4" />
          <circle cx="8" cy="13" r="1.2" fill="currentColor" />
          <path d="M2.5 13h4M9.5 13h4" />
        </svg>
      </span>
      <span class="icon-btn" v-if="treeState.root" :title="t('tree.closeFolder')" @click="emit('close-folder')">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
          <line x1="3" y1="3" x2="13" y2="13" /><line x1="13" y1="3" x2="3" y2="13" />
        </svg>
      </span>
    </div>

    <div class="flex-1 overflow-auto py-1" v-if="treeState.rootNode">
      <TreeItem :node="treeState.rootNode" :depth="0" />
    </div>

    <div v-else class="flex-1 flex flex-col items-center justify-center gap-3 px-4 text-center">
      <svg width="36" height="36" viewBox="0 0 16 16" fill="none" stroke="var(--muted)" stroke-width="1.2">
        <path d="M1.5 4A1.5 1.5 0 0 1 3 2.5h3l1.5 1.5H13A1.5 1.5 0 0 1 14.5 5.5v6A1.5 1.5 0 0 1 13 13H3A1.5 1.5 0 0 1 1.5 11.5V4z" />
      </svg>
      <p class="text-xs text-muted leading-5">
        {{ t("tree.emptyLine1") }}<br />{{ t("tree.emptyLine2") }}
      </p>
      <button class="np-btn primary" @click="pickFolder">{{ t("tree.openFolder") }}</button>
    </div>
  </div>
</template>

<style scoped>
/* DBX 同款侧栏实色分层 */
.sidebar-pane {
  background: var(--sidebar-solid);
}
</style>
