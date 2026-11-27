<script setup lang="ts">
import { defineAsyncComponent, onMounted, onBeforeUnmount, ref } from "vue";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import FileTree from "./components/FileTree.vue";
import TitleBar from "./components/TitleBar.vue";
import TabBar from "./components/TabBar.vue";
import EditorPane from "./components/EditorPane.vue";
import ImagePreview from "./components/ImagePreview.vue";
import StatusBar from "./components/StatusBar.vue";
import ConfirmModal from "./components/ConfirmModal.vue";
import Welcome from "./components/Welcome.vue";
import Toast from "./components/Toast.vue";
import GlobalTooltip from "./components/GlobalTooltip.vue";

// 弹窗类组件按需加载，减小首屏模块求值与主 chunk 体积
const SettingsPanel = defineAsyncComponent(() => import("./components/SettingsPanel.vue"));
const UpdateCenter = defineAsyncComponent(() => import("./components/UpdateCenter.vue"));
const ToolsPanel = defineAsyncComponent(() => import("./components/ToolsPanel.vue"));
const CommandPalette = defineAsyncComponent(() => import("./components/CommandPalette.vue"));
import { installGlobalTooltip } from "./stores/tooltip";
import { settings, initVisualSettings } from "./stores/settings";
import { updater } from "./stores/updater";
import { confirmChoice, toggleSettings, toggleUpdateCenter, toggleTools, togglePalette, ui } from "./stores/ui";
import { registerCommands, type PaletteCommand } from "./stores/commands";
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
  type Tab,
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
import {
  addCursorAbove,
  addCursorBelow,
} from "./editor/selection";
import { isMac, isWindows } from "./utils/platform";

// ---------- 启动动画（Splash）：等会话恢复完成后再淡出 ----------
const splashLeaving = ref(false);
const splashGone = ref(false);
let splashTimer1: number | undefined;
let splashTimer2: number | undefined;
let restoreFallback: number | undefined;

/** 会话恢复完成后启动淡出：800ms 开始淡出，1300ms 移除 */
function startSplashExit() {
  splashTimer1 = window.setTimeout(() => (splashLeaving.value = true), 800);
  splashTimer2 = window.setTimeout(() => (splashGone.value = true), 1300);
}

onBeforeUnmount(() => {
  clearTimeout(splashTimer1);
  clearTimeout(splashTimer2);
  clearTimeout(restoreFallback);
});

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

/** 批量关闭前确认未保存的更改；返回 false 表示用户取消或保存失败 */
async function confirmDiscard(tabs: Tab[]): Promise<boolean> {
  const dirty = tabs.filter((tab) => tab.dirty);
  if (!dirty.length) return true;
  const choice = await confirmChoice(
    t("confirm.unsavedTitle"),
    dirty.length === 1
      ? t("confirm.unsavedMsg", { name: dirty[0].name })
      : t("confirm.unsavedManyMsg", { count: dirty.length }),
    [t("common.save"), t("common.dontSave"), t("common.cancel")]
  );
  if (choice === t("common.save")) {
    for (const tab of dirty) {
      if (!(await saveTab(tab))) return false;
    }
    return true;
  }
  return choice === t("common.dontSave");
}

async function requestCloseAll() {
  if (await confirmDiscard(tabsState.tabs)) closeAllTabs();
}

async function requestCloseOthers(keepId: number) {
  if (await confirmDiscard(tabsState.tabs.filter((tab) => tab.id !== keepId))) {
    closeOtherTabs(keepId);
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

/** 判断文件路径是否位于文件夹内（统一分隔符，Windows 下忽略大小写） */
function isPathInFolder(path: string | null, folder: string): boolean {
  if (!path) return false;
  const norm = (v: string) => {
    const s = v.replace(/\\/g, "/").replace(/\/+$/, "");
    return isWindows ? s.toLowerCase() : s;
  };
  const root = norm(folder);
  const target = norm(path);
  if (!root) return target.startsWith("/");
  return target === root || target.startsWith(`${root}/`);
}

async function closeFolder() {
  const choice = await confirmChoice(t("confirm.closeFolderTitle"), t("confirm.closeFolderMsg"), [
    t("common.confirm"),
    t("common.cancel"),
  ]);
  if (choice !== t("common.confirm")) return;

  // 只关闭该文件夹内的标签，文件夹外打开的文件与未命名新文件保持打开
  const root = treeState.root;
  if (root) {
    const inFolder = tabsState.tabs.filter((tab) => isPathInFolder(tab.path, root));
    if (!(await confirmDiscard(inFolder))) return;
    for (const tab of inFolder) removeTab(tab.id);
  }
  treeState.root = null;
  treeState.rootNode = null;
  treeState.rootName = "";
  treeState.expanded.clear();
}

// ---------- 命令面板：注册可用操作 ----------
registerCommands([
  { id: "file.new", title: t("palette.cmd.newFile"), group: t("palette.groupFile"), shortcut: "⌘N", keywords: "new untitled", run: () => newTab() },
  { id: "file.open", title: t("palette.cmd.openFile"), group: t("palette.groupFile"), shortcut: "⌘O", keywords: "open file", run: () => openWithDialog() },
  { id: "file.openFolder", title: t("palette.cmd.openFolder"), group: t("palette.groupFile"), shortcut: "⇧⌘O", keywords: "folder workspace", run: () => openFolder() },
  { id: "file.save", title: t("palette.cmd.save"), group: t("palette.groupFile"), shortcut: "⌘S", keywords: "save", run: () => { if (activeTab.value) saveTab(activeTab.value); } },
  { id: "file.saveAs", title: t("palette.cmd.saveAs"), group: t("palette.groupFile"), shortcut: "⇧⌘S", keywords: "save as", run: () => { if (activeTab.value) saveTabAs(activeTab.value); } },
  { id: "file.saveAll", title: t("palette.cmd.saveAll"), group: t("palette.groupFile"), shortcut: "⌥⌘S", keywords: "save all", run: () => saveAll() },
  { id: "file.close", title: t("palette.cmd.closeTab"), group: t("palette.groupFile"), shortcut: "⌘W", keywords: "close tab", run: () => { if (tabsState.activeId !== null) requestClose(tabsState.activeId); } },
  { id: "file.closeAll", title: t("palette.cmd.closeAllTabs"), group: t("palette.groupFile"), shortcut: "⇧⌘W", keywords: "close all", run: () => requestCloseAll() },
  { id: "edit.find", title: t("palette.cmd.find"), group: t("palette.groupEdit"), shortcut: "⌘F", keywords: "find search replace", run: () => openFindWindow() },
  { id: "edit.formatJson", title: t("palette.cmd.formatJson"), group: t("palette.groupEdit"), shortcut: "⇧⌥F", keywords: "format json pretty", run: () => formatJsonDocument() },
  { id: "edit.addCursorAbove", title: t("palette.cmd.addCursorAbove"), group: t("palette.groupEdit"), shortcut: "⌥⌘↑", keywords: "multi cursor above", run: () => addCursorAbove() },
  { id: "edit.addCursorBelow", title: t("palette.cmd.addCursorBelow"), group: t("palette.groupEdit"), shortcut: "⌥⌘↓", keywords: "multi cursor below", run: () => addCursorBelow() },
  { id: "view.sidebar", title: t("palette.cmd.toggleSidebar"), group: t("palette.groupView"), shortcut: "⌘B", keywords: "sidebar file tree", run: () => { settings.sidebarVisible = !settings.sidebarVisible; } },
  { id: "view.zoomIn", title: t("palette.cmd.zoomIn"), group: t("palette.groupView"), shortcut: "⌘=", keywords: "zoom in bigger font", run: () => zoomIn() },
  { id: "view.zoomOut", title: t("palette.cmd.zoomOut"), group: t("palette.groupView"), shortcut: "⌘-", keywords: "zoom out smaller font", run: () => zoomOut() },
  { id: "view.zoomReset", title: t("palette.cmd.zoomReset"), group: t("palette.groupView"), shortcut: "⌘0", keywords: "reset zoom font", run: () => zoomReset() },
  { id: "view.settings", title: t("palette.cmd.settings"), group: t("palette.groupView"), shortcut: "⌘,", keywords: "settings preferences", run: () => toggleSettings() },
  { id: "view.tools", title: t("palette.cmd.tools"), group: t("palette.groupView"), keywords: "tools", run: () => toggleTools(true) },
  { id: "view.updates", title: t("palette.cmd.updates"), group: t("palette.groupView"), keywords: "update check version", run: () => toggleUpdateCenter(true) },
  { id: "palette.commands", title: t("palette.cmd.commandPalette"), group: t("palette.groupView"), shortcut: "⇧⌘P", keywords: "command palette", run: () => togglePalette(true) },
] as PaletteCommand[]);

// ---------- 键盘快捷键（Notepad++ 风格） ----------
function onKeydown(e: KeyboardEvent) {
  // 命令面板打开时只由面板自身处理键盘（Esc 在其捕获阶段已 stopPropagation）
  if (ui.showPalette) return;

  const mod = e.metaKey || e.ctrlKey;
  const key = e.key.toLowerCase();

  // 命令面板（面板自身在捕获阶段处理 Esc/导航，这里只管打开）
  if (mod && e.shiftKey && !e.altKey && key === "p") {
    e.preventDefault();
    togglePalette(true);
    return;
  }

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
    requestCloseAll();
  } else if (mod && key === "f") {
    e.preventDefault();
    openFindWindow();
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
  // 恢复上次会话（只同步读激活标签，其余标签懒加载）
  initSessionAutosave();
  // 等恢复完成再结束 Splash；极端情况下 5s 兜底，避免恢复异常卡住启动画面
  await Promise.race([
    restoreSession().catch((e) => console.error("[Session] 恢复失败:", e)),
    new Promise<void>((resolve) => {
      restoreFallback = window.setTimeout(resolve, 5000);
    }),
  ]);
  clearTimeout(restoreFallback);
  startSplashExit();
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
          @close-others="requestCloseOthers"
          @close-all="requestCloseAll"
        />
        <div class="flex-1 min-h-0 relative">
          <ImagePreview v-if="activeTab?.kind === 'image'" :tab="activeTab" />
          <EditorPane v-else-if="tabsState.tabs.length" />
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
    <CommandPalette v-if="ui.showPalette" />

    <!-- 启动动画：遮住首屏加载，品牌定格后整体淡出 -->
    <Teleport to="body">
      <div v-if="!splashGone" class="splash" :class="{ leaving: splashLeaving }">
        <div class="splash-inner">
          <div class="splash-logo">
            <svg width="104" height="104" viewBox="0 0 34 34" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <rect x="7" y="4" width="20" height="26" rx="4" />
              <line x1="12" y1="12" x2="22" y2="12" /><line x1="12" y1="17" x2="22" y2="17" />
              <line x1="12" y1="22" x2="18" y2="22" />
            </svg>
            <span class="splash-plus">+</span>
          </div>
          <div class="splash-name">NotePlus+</div>
          <div class="splash-slogan">{{ t("splash.slogan") }}</div>
          <div class="splash-sub">{{ t("splash.subtitle", { os: isMac ? "macOS" : "Windows" }) }}</div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.splash {
  position: fixed;
  inset: 0;
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  /* 渐变背景：中央强调色光晕向外淡入面板色 */
  background: radial-gradient(
    1100px 760px at 50% 42%,
    color-mix(in srgb, var(--accent) 16%, var(--panel)) 0%,
    var(--panel) 62%
  );
  opacity: 1;
  transition: opacity 0.5s ease;
  user-select: none;
}
/* Logo 背后的柔光晕（缓慢呼吸） */
.splash::before {
  content: "";
  position: absolute;
  width: 760px;
  height: 760px;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    color-mix(in srgb, var(--accent) 30%, transparent) 0%,
    transparent 70%
  );
  filter: blur(36px);
  animation: splash-glow 3.2s ease-in-out infinite alternate;
  pointer-events: none;
}
@keyframes splash-glow {
  0% { opacity: 0.55; transform: scale(0.92); }
  100% { opacity: 1; transform: scale(1.08); }
}
.splash.leaving {
  opacity: 0;
  pointer-events: none;
}
.splash-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.splash-logo {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 170px;
  height: 170px;
  margin-bottom: 16px;
  border-radius: 42px;
  color: var(--accent);
  /* 渐变卡片底 + 渐变描边 */
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--accent) 22%, var(--panel-2)),
    var(--panel-2) 70%
  );
  border: 1px solid color-mix(in srgb, var(--accent) 40%, var(--border));
  box-shadow: 0 16px 56px color-mix(in srgb, var(--accent) 28%, rgba(0, 0, 0, 0.2));
  animation: splash-logo-in 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
}
.splash-plus {
  position: absolute;
  right: -6px;
  bottom: -6px;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: var(--panel);
  /* 渐变徽标：强调色 → 提亮版强调色 */
  background: linear-gradient(
    135deg,
    var(--accent),
    color-mix(in srgb, var(--accent) 62%, #ffffff)
  );
  box-shadow: 0 4px 14px color-mix(in srgb, var(--accent) 45%, transparent);
  font-size: 30px;
  font-weight: 700;
  line-height: 1;
  animation: splash-plus-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.45s both;
}
.splash-name {
  position: relative;
  z-index: 1;
  font-size: 44px;
  font-weight: 700;
  letter-spacing: 0.02em;
  /* 品牌名渐变文字：文字色 → 强调色 */
  background: linear-gradient(
    100deg,
    var(--text) 30%,
    color-mix(in srgb, var(--accent) 75%, var(--text)) 90%
  );
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: splash-fade-up 0.5s ease 0.3s both;
}
.splash-slogan {
  position: relative;
  z-index: 1;
  font-size: 27px;
  font-weight: 600;
  letter-spacing: 0.18em;
  /* 标语渐变文字：强调色 → 提亮版，带缓慢流光 */
  background: linear-gradient(
    100deg,
    color-mix(in srgb, var(--accent) 65%, #ffffff) 0%,
    var(--accent) 45%,
    color-mix(in srgb, var(--accent) 65%, #ffffff) 100%
  );
  background-size: 200% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: splash-fade-up 0.5s ease 0.55s both, splash-shimmer 2.4s linear infinite;
}
@keyframes splash-shimmer {
  0% { background-position: 0% 0; }
  100% { background-position: 200% 0; }
}
.splash-sub {
  font-size: 20px;
  color: var(--muted);
  animation: splash-fade-up 0.5s ease 0.8s both;
}
@keyframes splash-logo-in {
  0% { opacity: 0; transform: scale(0.6) translateY(10px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes splash-plus-in {
  0% { opacity: 0; transform: scale(0.2); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes splash-fade-up {
  0% { opacity: 0; transform: translateY(8px); }
  100% { opacity: 1; transform: translateY(0); }
}
</style>
