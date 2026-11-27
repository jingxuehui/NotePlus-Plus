import { watch } from "vue";
import { saveSession, loadSession, clearSession, readTextFile } from "@/commands";
import {
  tabsState,
  docText,
  restoreTab,
  restoreImageTab,
  setActive,
} from "./tabs";
import { isImagePath } from "@/utils/image";
import { loadRoot, treeState } from "./filetree";
import { settings } from "./settings";
import { t } from "@/i18n";

/**
 * 会话持久化：关闭程序后下次启动恢复
 * - 打开的标签页（路径 / 当前编辑内容 / 编码 / 换行符 / dirty）
 * - 活动标签
 * - 侧边栏打开的文件夹
 * 内容存入应用数据目录 session.json（Rust 侧），比 localStorage 容量更大
 */

interface SessionTab {
  path: string | null;
  name: string;
  content: string;
  encoding: string;
  eol: string;
  dirty: boolean;
  /** 固定标签页（旧版快照没有该字段，按未固定处理） */
  pinned?: boolean;
}

interface SessionData {
  version: 1;
  tabs: SessionTab[];
  activeIndex: number;
  folder: string | null;
}

const EMPTY: SessionData = { version: 1, tabs: [], activeIndex: -1, folder: null };

// 单标签内容上限（约 4MB），超出则只记路径，恢复时从磁盘重读
const MAX_CONTENT_CHARS = 4 * 1024 * 1024;

function serialize(): SessionData {
  const tabs: SessionTab[] = tabsState.tabs.map((t) => {
    // 未修改的磁盘文件重读磁盘即可，不必把整份内容写进会话；
    // 只有未保存 / 新文件的内容才需要进入快照
    const text = (!t.dirty && t.path) || t.kind === "image" ? "" : docText(t);
    return {
      path: t.path,
      name: t.name,
      content: text.length <= MAX_CONTENT_CHARS ? text : "",
      encoding: t.encoding,
      eol: t.eol,
      dirty: t.dirty,
      pinned: t.pinned,
    };
  });
  const activeIndex = tabsState.tabs.findIndex((t) => t.id === tabsState.activeId);
  return { version: 1, tabs, activeIndex, folder: treeState.root };
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

/** 立即写一次会话（防抖到期 / 页面隐藏 / 关闭前调用） */
export function saveSessionNow(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  const data = tabsState.tabs.length || treeState.root ? serialize() : EMPTY;
  const json = JSON.stringify(data);
  const p = tabsState.tabs.length || treeState.root
    ? saveSession(json)
    : clearSession();
  p.catch(() => undefined);
}

function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveSessionNow, 250);
}

/** 启动会话自动保存监听 */
export function initSessionAutosave(): void {
  watch(tabsState, scheduleSave, { deep: true });
  watch(() => treeState.root, scheduleSave);
  // 关闭 / 隐藏窗口前尽量补写一次
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveSessionNow();
  });
  window.addEventListener("pagehide", saveSessionNow);
}

/**
 * 启动时恢复上次会话（Tab 内容懒加载）。
 * - 只同步读取当前激活标签的内容；其他标签只还原元数据，切换时再按需读盘/建 EditorState
 * - 未 dirty 的磁盘文件重读磁盘（同步外部修改；读取失败则回退用快照内容）
 * - dirty / 未保存的新文件直接用快照内容
 */
export async function restoreSession(): Promise<boolean> {
  let raw: string | null = null;
  try {
    raw = await loadSession();
  } catch {
    return false;
  }
  if (!raw) return false;

  let data: SessionData;
  try {
    data = JSON.parse(raw);
  } catch {
    return false;
  }
  if (!data || data.version !== 1 || !Array.isArray(data.tabs)) return false;

  if (data.folder) {
    try {
      await loadRoot(data.folder);
      settings.sidebarVisible = true;
    } catch {
      /* 文件夹不可用则忽略 */
    }
  }

  // 激活标签（无有效索引时取第一个）立即读取；其余标签延迟到切换时加载
  const targetIndex =
    data.activeIndex >= 0 && data.activeIndex < data.tabs.length
      ? data.activeIndex
      : 0;

  for (let i = 0; i < data.tabs.length; i++) {
    const st = data.tabs[i];
    const path = st.path ?? null;
    const name = st.name || path?.split(/[\\/]/).pop() || t("common.untitled");
    const pinned = st.pinned === true;
    const encoding = st.encoding || "UTF-8";
    const eol = st.eol || "LF";

    if (path && isImagePath(path)) {
      // 图片已被删除 / 移走时直接丢弃该标签
      await restoreImageTab(path, name, pinned).catch(() => undefined);
      continue;
    }
    if (i === targetIndex && !st.dirty && path) {
      try {
        const info = await readTextFile(path);
        restoreTab(path, name, info.content, info.encoding, info.eol, false, pinned);
        continue;
      } catch {
        // 读盘失败：先用快照内容恢复，并保留标记以便下次切换重试
        const tab = restoreTab(path, name, st.content ?? "", encoding, eol, st.dirty, pinned);
        if (path) tab.needsLoad = true;
        continue;
      }
    }

    // 非激活标签：内容与 EditorState 都延后创建，仅保留元数据
    restoreTab(
      path,
      name,
      st.content ?? "",
      encoding,
      eol,
      st.dirty,
      pinned,
      !!path && !st.dirty
    );
  }

  if (tabsState.tabs.length) {
    const idx = Math.min(targetIndex, tabsState.tabs.length - 1);
    setActive(tabsState.tabs[idx].id);
  }
  return tabsState.tabs.length > 0;
}
