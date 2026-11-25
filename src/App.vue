<script setup lang="ts">
import { defineAsyncComponent, onMounted, onBeforeUnmount } from "vue";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import FileTree from "./components/FileTree.vue";
import TitleBar from "./components/TitleBar.vue";
import TabBar from "./components/TabBar.vue";
import EditorPane from "./components/EditorPane.vue";
import StatusBar from "./components/StatusBar.vue";
import ConfirmModal from "./components/ConfirmModal.vue";
import Welcome from "./components/Welcome.vue";
import Toast from "./components/Toast.vue";
import GlobalTooltip from "./components/GlobalTooltip.vue";

// 弹窗类组件按需加载，减小首屏模块求值与主 chunk 体积
const SettingsPanel = defineAsyncComponent(() => import("./components/SettingsPanel.vue"));
const UpdateCenter = defineAsyncComponent(() => import("./components/UpdateCenter.vue"));
const ToolsPanel = defineAsyncComponent(() => import("./components/ToolsPanel.vue"));
import { installGlobalTooltip } from "./stores/tooltip";
import { settings, initVisualSettings } from "./stores/settings";
import { updater } from "./stores/updater";
import { confirmChoice, toggleSettings, ui } from "./stores/ui";
import { t } from "./i18n";
import {
  tabsState,
  activeTab,
  newTab,
  openWithDialog,
  openFolderWithDialog,
  openFiles,
  openPath,
  saveTab,
  saveTabAs,
  saveAll,
  removeTab,
  closeAllTabs,
  closeOtherTabs,
} from "./stores/tabs";
import { loadRoot, treeState } from "./stores/filetree";
import { initSessionAutosave, restoreSession } from "./stores/session";
import { zoomIn, zoomOut, zoomReset } from "./stores/settings";
import {
  openFindWindow,
  initFindBridge,
  findNextMatch,
  findPrevMatch,
} from "./find/bridge";
import { formatJsonDocument } from "./editor/format";

// 主题 / 配色 / 缩放等由 settings store 统一应用

// ---------- 关闭标签（含未保存确认） ----------
async function requestClose(tabId: number) {
  const tab = tabsState.tabs.find((t) => t.id === tabId);
  if (!tab) return;
  if (!tab.dirty) {
    removeTab(tabId);
    return;
  }
  const choice = await confirmChoice(
    t("confirm.unsavedTitle"),
    t("confirm.unsavedMsg", { name: tab.name }),
    [t("common.save"), t("common.dontSave"), t("common.cancel")]
  );
  if (choice === t("common.save")) {
    const ok = await saveTab(tab);
    if (ok) removeTab(tabId);
  } else if (choice === t("common.dontSave")) {
    removeTab(tabId);
  }
}

async function openFolder() {
  const dir = await openFolderWithDialog();
  if (dir) {
    try {
      await loadRoot(dir);
      settings.sidebarVisible = true;
    } catch (e) {
      console.error(e);
    }
  }
}

async function closeFolder() {
  const choice = await confirmChoice(t("confirm.closeFolderTitle"), t("confirm.closeFolderMsg"), [
    t("common.confirm"),
    t("common.cancel"),
  ]);
  if (choice === t("common.confirm")) {
    closeAllTabs();
    treeState.root = null;
    treeState.rootNode = null;
    treeState.rootName = "";
    treeState.expanded.clear();
  }
}

// ---------- 键盘快捷键（Notepad++ 风格） ----------
function onKeydown(e: KeyboardEvent) {
  const mod = e.metaKey || e.ctrlKey;
  const key = e.key.toLowerCase();

  if (mod && !e.shiftKey && !e.altKey && key === "s") {
    e.preventDefault();
    if (activeTab.value) saveTab(activeTab.value);
  } else if (mod && e.shiftKey && !e.altKey && key === "s") {
    e.preventDefault();
    if (activeTab.value) saveTabAs(activeTab.value);
  } else if (mod && e.altKey && key === "s") {
    e.preventDefault();
    saveAll();
  } else if (mod && !e.shiftKey && !e.altKey && key === "n") {
    e.preventDefault();
    newTab();
  } else if (mod && !e.shiftKey && !e.altKey && key === "o") {
    e.preventDefault();
    openWithDialog();
  } else if (mod && e.shiftKey && !e.altKey && key === "o") {
    e.preventDefault();
    openFolder();
  } else if (mod && !e.shiftKey && !e.altKey && key === "w") {
    e.preventDefault();
    if (tabsState.activeId !== null) requestClose(tabsState.activeId);
  } else if (mod && e.shiftKey && !e.altKey && key === "w") {
    e.preventDefault();
    closeAllTabs();
  } else if (mod && key === "f") {
    e.preventDefault();
    openFindWindow();
  } else if (mod && key === "g") {
    e.preventDefault();
    if (e.shiftKey) findPrevMatch();
    else findNextMatch();
  } else if (key === "f3") {
    e.preventDefault();
    if (e.shiftKey) findPrevMatch();
    else findNextMatch();
  } else if (e.shiftKey && e.altKey && !mod && e.code === "KeyF") {
    // ⇧⌥F：格式化 JSON
    e.preventDefault();
    formatJsonDocument();
  } else if (mod && (key === "=" || key === "+")) {
    e.preventDefault();
    zoomIn();
  } else if (mod && key === "-") {
    e.preventDefault();
    zoomOut();
  } else if (mod && key === "0") {
    e.preventDefault();
    zoomReset();
  } else if (mod && key === "b") {
    e.preventDefault();
    settings.sidebarVisible = !settings.sidebarVisible;
  } else if (mod && key === ",") {
    e.preventDefault();
    toggleSettings();
  }
}

// ---------- 拖拽文件打开 ----------
let unlistenDrag: (() => void) | null = null;
let uninstallTip: (() => void) | null = null;

onMounted(async () => {
  initVisualSettings();
  updater.initUpdater();
  uninstallTip = installGlobalTooltip();
  window.addEventListener("keydown", onKeydown);
  initFindBridge();
  // 恢复上次会话（标签页 / 未保存内容 / 打开的文件夹）
  initSessionAutosave();
  restoreSession().catch(() => undefined);
  try {
    unlistenDrag = await getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === "drop") {
        const files = event.payload.paths.filter((p) => !p.endsWith("/"));
        if (files.length) openFiles(files);
      }
    });
  } catch (e) {
    console.warn("drag-drop 不可用", e);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
  unlistenDrag?.();
  uninstallTip?.();
});
</script>

<template>
  <div class="h-full flex flex-col bg-app text-main">
    <TitleBar
      @new="newTab"
      @open="openWithDialog"
      @open-folder="openFolder"
      @save="activeTab && saveTab(activeTab)"
      @save-as="activeTab && saveTabAs(activeTab)"
      @save-all="saveAll"
    />
    <div class="flex flex-1 min-h-0 main-row">
      <FileTree v-if="settings.sidebarVisible" @close-folder="closeFolder" />
      <div class="flex-1 flex flex-col min-w-0 min-h-0 right-col">
        <TabBar
          @close="requestClose"
          @close-others="closeOtherTabs"
          @close-all="closeAllTabs"
        />
        <div class="flex-1 min-h-0 relative">
          <EditorPane v-if="tabsState.tabs.length" />
          <Welcome v-else @open="openWithDialog" @open-folder="openFolder" @open-path="openPath" />
        </div>
      </div>
    </div>
    <StatusBar v-if="settings.toolbar.statusBar" />
    <ConfirmModal />
    <Toast />
    <GlobalTooltip />
    <SettingsPanel v-if="ui.showSettings" />
    <UpdateCenter v-if="ui.showUpdateCenter" />
    <ToolsPanel v-if="ui.showTools" />
  </div>
</template>
