import { reactive, computed } from "vue";
import type { EditorState } from "@codemirror/state";
import { save as saveDialog, open as openDialog } from "@tauri-apps/plugin-dialog";
import { createStateForFile, updateLanguageForPath } from "@/editor/setup";
import { viewRef } from "@/editor/view";
import { languageName } from "@/editor/language";
import { readTextFile, writeTextFile } from "@/commands";
import { pushRecent } from "./recent";
import { settings } from "./settings";
import { notify } from "./toast";
import { EMPTY_CURSOR, type CursorInfo } from "@/types";

let uid = 0;

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
  eol: string
): Tab {
  const tab: Tab = {
    id: ++uid,
    path,
    name,
    dirty: false,
    encoding,
    eol,
    language: path ? languageName(path) : "纯文本",
    pinned: false,
  };
  setState(tab, createStateForFile(path, content, editorHooks));
  return tab;
}

export function setActive(id: number) {
  tabsState.activeId = id;
  const tab = activeTab.value;
  const s = tab ? stateStore.get(tab.id) : undefined;
  if (s) updateCursorFromState(s);
}

export function newTab(): Tab {
  const count = tabsState.tabs.filter((t) => !t.path).length + 1;
  const tab = makeTab(null, `新文件 ${count}.txt`, "", "UTF-8", "LF");
  tabsState.tabs.push(tab);
  setActive(tab.id);
  return tab;
}

/** 会话恢复专用：按上次快照重建标签（不切换激活、不写最近列表） */
export function restoreTab(
  path: string | null,
  name: string,
  content: string,
  encoding: string,
  eol: string,
  dirty: boolean,
  pinned = false
): Tab {
  const tab = makeTab(path, name, content, encoding, eol);
  tab.dirty = dirty;
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
    const info = await readTextFile(path);
    const name = path.split("/").pop() ?? path;
    const tab = makeTab(path, name, info.content, info.encoding, info.eol);
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
  const picked = await openDialog({ multiple: true });
  if (picked) await openFiles(picked);
}

export async function openFolderWithDialog(): Promise<string | null> {
  const picked = await openDialog({ directory: true, multiple: false });
  return picked ?? null;
}

export function removeTab(id: number) {
  const idx = tabsState.tabs.findIndex((t) => t.id === id);
  if (idx < 0) return;
  tabsState.tabs.splice(idx, 1);
  stateStore.delete(id);
  if (tabsState.activeId === id) {
    const next = tabsState.tabs[Math.min(idx, tabsState.tabs.length - 1)];
    tabsState.activeId = next ? next.id : null;
  }
}

export function docText(tab: Tab): string {
  return stateStore.get(tab.id)?.doc.toString() ?? "";
}

export async function saveTab(tab: Tab): Promise<boolean> {
  if (!tab.path) return saveTabAs(tab);
  try {
    await writeTextFile(tab.path, docText(tab), tab.encoding, tab.eol);
    tab.dirty = false;
    pushRecent(tab.path);
    notify("已保存", false);
    return true;
  } catch (e) {
    notify(typeof e === "string" ? e : String(e));
    return false;
  }
}

export async function saveTabAs(tab: Tab): Promise<boolean> {
  // 保存对话框不传 filters：macOS 会把 filters 的首个扩展名自动追加到文件名末尾，
  // 传 ["*"] 会把「新文件 1.sql」保存成「新文件 1.sql.*」。
  const path = await saveDialog({
    title: "保存文件",
    defaultPath: tab.name,
  });
  if (!path) return false;
  // 用户未输入扩展名时，沿用当前标签的扩展名，避免保存成无类型文件
  const ext = /\.[^./\\]+$/.exec(tab.name)?.[0] ?? "";
  const finalPath = ext && !/\.[^./\\]+$/.test(path) ? path + ext : path;
  try {
    await writeTextFile(finalPath, docText(tab), tab.encoding, tab.eol);
    tab.path = finalPath;
    tab.name = finalPath.split("/").pop() ?? finalPath;
    tab.language = languageName(finalPath);
    // 另存为其它类型后立即切换语法高亮
    if (viewRef.current && tabsState.activeId === tab.id) {
      void updateLanguageForPath(viewRef.current, finalPath);
    }
    tab.dirty = false;
    pushRecent(finalPath);
    notify("已保存", false);
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
  tabsState.tabs.forEach((t) => stateStore.delete(t.id));
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
    stateStore.delete(t.id);
    tabsState.tabs.splice(i, 1);
  }
  tabsState.activeId = id;
}
