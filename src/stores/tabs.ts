import { reactive, computed } from "vue";
import type { EditorState } from "@codemirror/state";
import { createStateForFile, updateLanguageForPath } from "@/editor/setup";
import { viewRef } from "@/editor/view";
import { fileExtension, languageName } from "@/editor/language";
import {
  nativeOpenPaths,
  nativeSaveFile,
  readBinaryFile,
  readTextFile,
  writeTextFile,
} from "@/commands";
import { imageMime, isImagePath } from "@/utils/image";
import { pushRecent } from "./recent";
import { settings } from "./settings";
import { notify } from "./toast";
import { t } from "@/i18n";
import { EMPTY_CURSOR, type CursorInfo } from "@/types";
import { baseName } from "@/utils/path";

let uid = 0;
/** 文件对话框防重入：连续点击/快捷键重复触发会让原生对话框互相嵌套导致卡死 */
let dialogBusy = false;
async function withDialog<T>(run: () => Promise<T>): Promise<T | null> {
  if (dialogBusy) return null;
  dialogBusy = true;
  try {
    return await run();
  } finally {
    dialogBusy = false;
  }
}

/** 原生对话框异常统一提示，避免 invoke reject 变成静默「没反应」 */
async function dialogCall<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch (e) {
    notify(typeof e === "string" ? e : String(e), true);
    return fallback;
  }
}

export interface Tab {
  id: number;
  path: string | null;
  name: string;
  dirty: boolean;
  encoding: string;
  eol: string;
  language: string;
  /** 固定标签页：始终排在标签栏最前面 */
  pinned: boolean;
  /** 会话恢复时只还原了元数据，切换到该标签时再从磁盘加载内容 */
  needsLoad: boolean;
  /** text：CodeMirror 编辑；image：只读图片预览 */
  kind: "text" | "image";
  /** 图片标签的 object URL，关闭标签时释放 */
  imageUrl: string | null;
  /** 图片文件大小（字节） */
  imageBytes: number;
  /** 图片像素尺寸，预览加载完成后回填 */
  imageWidth: number;
  imageHeight: number;
}

interface TabsState {
  tabs: Tab[];
  activeId: number | null;
}

export const tabsState = reactive<TabsState>({
  tabs: [],
  activeId: null,
});

export const cursorInfo = reactive<CursorInfo>({ ...EMPTY_CURSOR });

export const activeTab = computed<Tab | null>(
  () => tabsState.tabs.find((t) => t.id === tabsState.activeId) ?? null
);

/**
 * EditorState 存放在非响应式 Map 中：
 * 避免被 Vue reactive 代理破坏 CodeMirror 的内部相等性判断。
 */
const stateStore = new Map<number, EditorState>();
/** 正在异步加载内容的标签，避免快速切换时重复读盘 */
const loadingTabs = new Set<number>();

export function getState(tab: Tab): EditorState | undefined {
  return stateStore.get(tab.id);
}

export function setState(tab: Tab, state: EditorState) {
  stateStore.set(tab.id, state);
}

export const editorHooks = {
  getTheme: () => settings.theme,
  getFontSize: () => settings.fontSize,
  getWordWrap: () => settings.wordWrap,
  onDocChanged: () => {
    const tab = activeTab.value;
    if (tab) {
      tab.dirty = true;
      const s = stateStore.get(tab.id);
      if (s) updateCursorFromState(s);
    }
  },
  onCursor: (info: CursorInfo) => Object.assign(cursorInfo, info),
};

function updateCursorFromState(state: EditorState) {
  const head = state.selection.main.head;
  const line = state.doc.lineAt(head);
  cursorInfo.line = line.number;
  cursorInfo.col = head - line.from + 1;
  cursorInfo.selected = Math.abs(state.selection.main.to - state.selection.main.from);
  cursorInfo.lines = state.doc.lines;
  cursorInfo.chars = state.doc.length;
}

function makeTab(
  path: string | null,
  name: string,
  content: string,
  encoding: string,
  eol: string,
  deferState = false
): Tab {
  const tab: Tab = {
    id: ++uid,
    path,
    name,
    dirty: false,
    encoding,
    eol,
    language: path ? languageName(path) : t("common.plainText"),
    pinned: false,
    needsLoad: false,
    kind: "text",
    imageUrl: null,
    imageBytes: 0,
    imageWidth: 0,
    imageHeight: 0,
  };
  // 懒加载标签连 EditorState 都延后创建，减少启动时的 CPU / 内存开销
  if (!deferState) setState(tab, createStateForFile(path, content, editorHooks));
  return tab;
}

async function makeImageTab(path: string, name: string): Promise<Tab> {
  const buf = await readBinaryFile(path);
  const blob = new Blob([buf], { type: imageMime(path) ?? "" });
  return {
    id: ++uid,
    path,
    name,
    dirty: false,
    encoding: "",
    eol: "",
    language: fileExtension(path).toUpperCase(),
    pinned: false,
    needsLoad: false,
    kind: "image",
    imageUrl: URL.createObjectURL(blob),
    imageBytes: buf.byteLength,
    imageWidth: 0,
    imageHeight: 0,
  };
}

/** 释放标签占用的编辑器状态与图片 object URL */
function disposeTab(tab: Tab) {
  stateStore.delete(tab.id);
  if (tab.imageUrl) URL.revokeObjectURL(tab.imageUrl);
}

export function setActive(id: number) {
  tabsState.activeId = id;
  const tab = activeTab.value;
  const s = tab ? stateStore.get(tab.id) : undefined;
  if (s) updateCursorFromState(s);
  else Object.assign(cursorInfo, EMPTY_CURSOR);
  if (tab?.needsLoad) void ensureTabLoaded(tab);
}

/**
 * 按需加载会话恢复时标记为 needsLoad 的标签内容。
 * - 只在磁盘文件、非 dirty 的标签上使用，避免覆盖未保存修改
 * - 加载完成后同步替换当前视图状态（若仍激活）
 */
export async function ensureTabLoaded(tab: Tab): Promise<void> {
  if (!tab.needsLoad || !tab.path || loadingTabs.has(tab.id)) return;
  loadingTabs.add(tab.id);
  try {
    // 加载期间标签可能已被关闭，或用户已经开始编辑（此时不能覆盖）
    if (!tabsState.tabs.includes(tab) || !tab.needsLoad || !tab.path) return;
    if (tab.dirty) {
      tab.needsLoad = false;
      return;
    }
    const info = await readTextFile(tab.path);
    if (!tabsState.tabs.includes(tab) || !tab.path) return;
    if (tab.dirty) {
      tab.needsLoad = false;
      return;
    }
    tab.encoding = info.encoding;
    tab.eol = info.eol;
    const state = createStateForFile(tab.path, info.content, editorHooks);
    setState(tab, state);
    tab.needsLoad = false;
    if (tabsState.activeId === tab.id) {
      updateCursorFromState(state);
      const view = viewRef.current;
      if (view && view.state !== state) {
        view.setState(state);
        void updateLanguageForPath(view, tab.path);
        view.focus();
      }
    }
  } catch (e) {
    // 读盘失败时保留元数据与 needsLoad，下次切换再试；不覆盖当前状态
    console.warn("[Tabs] 懒加载文件失败", tab.path, e);
  } finally {
    loadingTabs.delete(tab.id);
  }
}

export function newTab(): Tab {
  const count = tabsState.tabs.filter((t) => !t.path).length + 1;
  const tab = makeTab(null, `${t("common.newFile")} ${count}.txt`, "", "UTF-8", "LF");
  tabsState.tabs.push(tab);
  setActive(tab.id);
  return tab;
}

/** 会话恢复专用：按上次快照重建标签（不切换激活、不写最近列表）；lazy 标签不创建 EditorState */
export function restoreTab(
  path: string | null,
  name: string,
  content: string,
  encoding: string,
  eol: string,
  dirty: boolean,
  pinned = false,
  lazy = false
): Tab {
  const tab = makeTab(path, name, content, encoding, eol, lazy);
  tab.dirty = dirty;
  tab.pinned = pinned;
  tab.needsLoad = lazy && !!path && !dirty;
  tabsState.tabs.push(tab);
  return tab;
}

/** 会话恢复专用：重新读取图片并重建预览标签 */
export async function restoreImageTab(path: string, name: string, pinned = false): Promise<Tab> {
  const tab = await makeImageTab(path, name);
  tab.pinned = pinned;
  tabsState.tabs.push(tab);
  return tab;
}

/**
 * 固定 / 取消固定标签页。
 * 固定标签统一排列在最前面（按固定顺序追加），取消固定后回到非固定区开头，
 * 这样标签栏的物理顺序即展示顺序，其余按索引处理激活标签的逻辑不用改。
 */
export function setPinned(id: number, pinned: boolean): void {
  const tab = tabsState.tabs.find((t) => t.id === id);
  if (!tab || tab.pinned === pinned) return;
  tab.pinned = pinned;

  const idx = tabsState.tabs.indexOf(tab);
  tabsState.tabs.splice(idx, 1);
  if (pinned) {
    // 追加到固定区末尾
    const pinnedCount = tabsState.tabs.filter((t) => t.pinned).length;
    tabsState.tabs.splice(pinnedCount, 0, tab);
  } else {
    // 回到非固定区开头
    const firstUnpinned = tabsState.tabs.findIndex((t) => !t.pinned);
    tabsState.tabs.splice(
      firstUnpinned < 0 ? tabsState.tabs.length : firstUnpinned,
      0,
      tab
    );
  }
}

/** 切换固定状态 */
export function togglePinned(id: number): void {
  const tab = tabsState.tabs.find((t) => t.id === id);
  if (tab) setPinned(id, !tab.pinned);
}

/** 重命名标签（只改显示名，不改动文件路径 / 语法类型） */
export function renameTab(id: number, name: string): void {
  const tab = tabsState.tabs.find((t) => t.id === id);
  if (!tab) return;
  const trimmed = name.trim();
  if (trimmed) tab.name = trimmed;
}

/** 已固定的标签数量（标签栏用它画分组分隔） */
export const pinnedCount = computed(
  () => tabsState.tabs.filter((t) => t.pinned).length
);

export async function openPath(path: string): Promise<void> {
  const existing = tabsState.tabs.find((t) => t.path === path);
  if (existing) {
    setActive(existing.id);
    return;
  }
  try {
    let tab: Tab;
    if (isImagePath(path)) {
      tab = await makeImageTab(path, baseName(path));
    } else {
      const info = await readTextFile(path);
      tab = makeTab(path, baseName(path), info.content, info.encoding, info.eol);
    }
    tabsState.tabs.push(tab);
    setActive(tab.id);
    pushRecent(path);
  } catch (e) {
    notify(typeof e === "string" ? e : String(e));
  }
}

export async function openFiles(paths: string[]) {
  for (const p of paths) {
    await openPath(p);
  }
}

export async function openWithDialog(): Promise<void> {
  const picked = await withDialog(() =>
    dialogCall(() => nativeOpenPaths(t("dialog.openFile"), true, false), null)
  );
  if (picked?.length) await openFiles(picked);
}

export async function openFolderWithDialog(): Promise<string | null> {
  const picked = await withDialog(() =>
    dialogCall(() => nativeOpenPaths(t("dialog.openFolder"), false, true), null)
  );
  return picked?.[0] ?? null;
}

export function removeTab(id: number) {
  const idx = tabsState.tabs.findIndex((t) => t.id === id);
  if (idx < 0) return;
  const [tab] = tabsState.tabs.splice(idx, 1);
  disposeTab(tab);
  if (tabsState.activeId === id) {
    const next = tabsState.tabs[Math.min(idx, tabsState.tabs.length - 1)];
    tabsState.activeId = next ? next.id : null;
  }
}

export function docText(tab: Tab): string {
  return stateStore.get(tab.id)?.doc.toString() ?? "";
}

export async function saveTab(tab: Tab): Promise<boolean> {
  // 图片标签只读：按文本写回会把图片覆盖成空文件
  if (tab.kind === "image") return true;
  if (!tab.path) return saveTabAs(tab);
  // 懒加载标签必须先读到真实内容，避免把空状态写回磁盘
  if (tab.needsLoad) {
    await ensureTabLoaded(tab);
    if (tab.needsLoad) {
      notify(t("common.loadFail", { name: tab.name }), true);
      return false;
    }
  }
  try {
    await writeTextFile(tab.path, docText(tab), tab.encoding, tab.eol);
    tab.dirty = false;
    pushRecent(tab.path);
    notify(t("common.saved"), false);
    return true;
  } catch (e) {
    notify(typeof e === "string" ? e : String(e));
    return false;
  }
}

export async function saveTabAs(tab: Tab): Promise<boolean> {
  if (tab.kind === "image") return false;
  if (tab.needsLoad) {
    await ensureTabLoaded(tab);
    if (tab.needsLoad) {
      notify(t("common.loadFail", { name: tab.name }), true);
      return false;
    }
  }
  // 保存对话框不传 filters：macOS 会把 filters 的首个扩展名自动追加到文件名末尾，
  // 传 ["*"] 会把「新文件 1.sql」保存成「新文件 1.sql.*」。
  const path = await withDialog(() =>
    dialogCall(() => nativeSaveFile(t("dialog.saveFile"), tab.name), null)
  );
  if (!path) return false;
  // 用户未输入扩展名时，沿用当前标签的扩展名，避免保存成无类型文件
  const ext = /\.[^./\\]+$/.exec(tab.name)?.[0] ?? "";
  const finalPath = ext && !/\.[^./\\]+$/.test(path) ? path + ext : path;
  try {
    await writeTextFile(finalPath, docText(tab), tab.encoding, tab.eol);
    tab.path = finalPath;
    tab.name = baseName(finalPath);
    tab.language = languageName(finalPath);
    // 另存为其它类型后立即切换语法高亮
    if (viewRef.current && tabsState.activeId === tab.id) {
      void updateLanguageForPath(viewRef.current, finalPath);
    }
    tab.dirty = false;
    pushRecent(finalPath);
    notify(t("common.saved"), false);
    return true;
  } catch (e) {
    notify(typeof e === "string" ? e : String(e));
    return false;
  }
}

export async function saveAll(): Promise<void> {
  for (const tab of [...tabsState.tabs]) {
    if (tab.dirty) await saveTab(tab);
  }
}

export function closeAllTabs() {
  tabsState.tabs.forEach(disposeTab);
  tabsState.tabs = [];
  tabsState.activeId = null;
}

/** 关闭除指定标签外的全部标签，并保留该标签为激活状态 */
export function closeOtherTabs(id: number): void {
  const keep = tabsState.tabs.find((t) => t.id === id);
  if (!keep) return;
  for (let i = tabsState.tabs.length - 1; i >= 0; i--) {
    const t = tabsState.tabs[i];
    if (t.id === id) continue;
    disposeTab(t);
    tabsState.tabs.splice(i, 1);
  }
  tabsState.activeId = id;
}
