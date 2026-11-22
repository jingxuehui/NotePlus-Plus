<script setup lang="ts">
import { onMounted, onBeforeUnmount } from "vue";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import FileTree from "./components/FileTree.vue";
import TitleBar from "./components/TitleBar.vue";
import TabBar from "./components/TabBar.vue";
import EditorPane from "./components/EditorPane.vue";
import SettingsPanel from "./components/SettingsPanel.vue";
import StatusBar from "./components/StatusBar.vue";
import ConfirmModal from "./components/ConfirmModal.vue";
import Welcome from "./components/Welcome.vue";
import Toast from "./components/Toast.vue";
import { settings, initVisualSettings } from "./stores/settings";
import { confirmChoice, toggleSettings, ui } from "./stores/ui";
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
} from "./stores/tabs";
import { loadRoot, treeState } from "./stores/filetree";
import { zoomIn, zoomOut, zoomReset } from "./stores/settings";
import {
  openFindWindow,
  initFindBridge,
  findNextMatch,
  findPrevMatch,
} from "./find/bridge";

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
    "未保存的更改",
    `「${tab.name}」有未保存的更改，是否保存？`,
    ["保存", "不保存", "取消"]
  );
  if (choice === "保存") {
    const ok = await saveTab(tab);
    if (ok) removeTab(tabId);
  } else if (choice === "不保存") {
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
  const choice = await confirmChoice("关闭文件夹", "确定关闭当前打开的文件夹吗？", [
    "确定",
    "取消",
  ]);
  if (choice === "确定") {
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
    tabsState.tabs.forEach((t) => removeTab(t.id));
  } else if (mod && key === "f") {
    e.preventDefault();
    openFindWindow();
  } else if (mod && key === "g") {
    e.preventDefault();
    if (e.shiftKey) findPrevMatch();
    else findNextMatch();
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

onMounted(async () => {
  initVisualSettings();
  window.addEventListener("keydown", onKeydown);
  initFindBridge();
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
});
</script>

<template>
  <div class="h-full flex flex-col bg-app text-main">
    <TitleBar
      @new="newTab"
      @open="openWithDialog"
      @open-folder="openFolder"
      @save="activeTab && saveTab(activeTab)"
      @save-all="saveAll"
    />
    <div class="flex flex-1 min-h-0 main-row">
      <FileTree v-if="settings.sidebarVisible" @close-folder="closeFolder" />
      <div class="flex-1 flex flex-col min-w-0 min-h-0 right-col">
        <TabBar @close="requestClose" />
        <div class="flex-1 min-h-0 relative">
          <EditorPane v-if="tabsState.tabs.length" />
          <Welcome v-else @open="openWithDialog" @open-folder="openFolder" @open-path="openPath" />
        </div>
      </div>
    </div>
    <StatusBar />
    <ConfirmModal />
    <Toast />
    <SettingsPanel v-if="ui.showSettings" />
  </div>
</template>
