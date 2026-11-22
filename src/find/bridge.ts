import { watch } from "vue";
import { emitTo, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { EditorSelection } from "@codemirror/state";
import { SearchQuery } from "@codemirror/search";
import type { EditorView } from "@codemirror/view";
import { viewRef } from "@/editor/view";
import { setMatchHighlight } from "@/editor/matchHighlight";
import { settings, ACCENTS } from "@/stores/settings";

export interface FindQueryState {
  search: string;
  replace: string;
  caseSensitive: boolean;
  regexp: boolean;
}

export const EMPTY_QUERY: FindQueryState = {
  search: "",
  replace: "",
  caseSensitive: false,
  regexp: false,
};

let query: FindQueryState = { ...EMPTY_QUERY };
let initialized = false;
let unlisteners: UnlistenFn[] = [];

/** 当前强调色：查找窗口是独立 WebView，需要显式同步才能与主窗口一致 */
function currentAccent(): string {
  const a = ACCENTS[settings.accent] ?? ACCENTS.blue;
  return settings.theme === "light" ? a.light : a.dark;
}

function makeQuery(): SearchQuery {
  return new SearchQuery({
    search: query.search,
    replace: query.replace,
    caseSensitive: query.caseSensitive,
    regexp: query.regexp,
  });
}

function sendCount(count: number) {
  emitTo("find", "find:count", { count }).catch(() => undefined);
}

function selectedText(): string {
  const view = viewRef.current;
  if (!view) return "";
  const range = view.state.selection.main;
  if (range.empty) return "";
  return view.state.sliceDoc(range.from, range.to);
}

/** 按当前查询收集文档内所有匹配 */
function collectMatches(view: EditorView, q: SearchQuery): { from: number; to: number }[] {
  const out: { from: number; to: number }[] = [];
  try {
    const cursor = q.getCursor(view.state);
    for (let result = cursor.next(); !result.done; result = cursor.next()) {
      out.push({ from: result.value.from, to: result.value.to });
      if (out.length > 99999) break;
    }
  } catch {
    /* 非法正则 */
  }
  return out;
}

/** 选中下一个 / 上一个匹配（循环），返回匹配总数 */
function selectMatch(view: EditorView, q: SearchQuery, dir: 1 | -1): number {
  const list = collectMatches(view, q);
  if (!list.length) return 0;
  const sel = view.state.selection.main;
  let target: { from: number; to: number };
  if (dir > 0) {
    target = list.find((m) => m.from >= sel.to) ?? list[0];
  } else {
    const before = list.filter((m) => m.to <= sel.from);
    target = before.length ? before[before.length - 1] : list[list.length - 1];
  }
  view.dispatch({ selection: { anchor: target.from, head: target.to }, scrollIntoView: true });
  return list.length;
}

/** 替换当前匹配或全部，返回替换后剩余匹配数 */
function replaceMatches(view: EditorView, q: SearchQuery, all: boolean): number {
  const list = collectMatches(view, q);
  if (!list.length) return 0;
  const insert = q.replace ?? "";
  if (all) {
    view.dispatch({ changes: list.map((m) => ({ from: m.from, to: m.to, insert })) });
    return collectMatches(view, q).length;
  }
  const sel = view.state.selection.main;
  const current = list.find((m) => m.from <= sel.from && sel.to <= m.to);
  if (!current) return selectMatch(view, q, 1);
  view.dispatch({ changes: { from: current.from, to: current.to, insert } });
  const after = collectMatches(view, q);
  const next = after.find((m) => m.from >= current.from + insert.length);
  if (next) view.dispatch({ selection: { anchor: next.from, head: next.to }, scrollIntoView: true });
  return after.length;
}

/** 把当前查询应用到编辑器（自绘高亮），并回传匹配数量 */
function applyQuery() {
  const view = viewRef.current;
  if (!view) {
    sendCount(0);
    return;
  }
  if (!query.search) {
    view.dispatch({ effects: setMatchHighlight.of(null) });
    sendCount(0);
    return;
  }
  const q = makeQuery();
  view.dispatch({ effects: setMatchHighlight.of(q) });
  sendCount(collectMatches(view, q).length);
}

function findAll() {
  const view = viewRef.current;
  if (!view || !query.search) return;
  const q = makeQuery();
  view.dispatch({ effects: setMatchHighlight.of(q) });
  const list = collectMatches(view, q);
  sendCount(list.length);
  if (list.length) {
    view.dispatch({
      selection: EditorSelection.create(list.map((m) => EditorSelection.range(m.from, m.to))),
      scrollIntoView: true,
    });
    view.focus();
  }
}

async function handleAction(action: string) {
  const view = viewRef.current;
  if (!view) return;
  switch (action) {
    case "next":
      applyQuery();
      if (query.search) selectMatch(view, makeQuery(), 1);
      view.focus();
      break;
    case "prev":
      applyQuery();
      if (query.search) selectMatch(view, makeQuery(), -1);
      view.focus();
      break;
    case "replace":
      if (query.search) {
        applyQuery();
        sendCount(replaceMatches(view, makeQuery(), false));
      }
      view.focus();
      break;
    case "replaceAll":
      if (query.search) {
        applyQuery();
        sendCount(replaceMatches(view, makeQuery(), true));
      }
      view.focus();
      break;
    case "findAll":
      findAll();
      break;
    case "clearHighlights":
      view.dispatch({ effects: setMatchHighlight.of(null) });
      sendCount(0);
      break;
    default:
      break;
  }
}

/** 打开（或聚焦）查找窗口，并把当前选区预填给对话框 */
export async function openFindWindow() {
  try {
    await invoke("open_find_window", { dark: settings.theme === "dark" });
  } catch (e) {
    console.error(e);
    return;
  }
  const text = selectedText();
  if (text) {
    emitTo("find", "find:selection", { text }).catch(() => undefined);
  }
}

export async function findNextMatch() {
  await handleAction("next");
}

export async function findPrevMatch() {
  await handleAction("prev");
}

/** 主窗口初始化事件桥 */
export async function initFindBridge() {
  if (initialized) return;
  initialized = true;

  try {
    unlisteners.push(
      await listen<FindQueryState>("find:query", (event) => {
        query = event.payload;
        applyQuery();
      })
    );

    unlisteners.push(
      await listen<string>("find:action", (event) => {
        void handleAction(event.payload);
      })
    );

    // 对话框加载完成后握手：回传选区、主题、强调色与上次的查询
    unlisteners.push(
      await listen("find:init", () => {
        emitTo("find", "find:state", {
          selection: selectedText(),
          theme: settings.theme,
          accent: currentAccent(),
          query,
        }).catch(() => undefined);
      })
    );

    unlisteners.push(
      await listen("find:selection-request", () => {
        emitTo("find", "find:selection", { text: selectedText() }).catch(() => undefined);
      })
    );

    // 关闭查找窗口时保留匹配高亮与查询内容：高亮由编辑器内的自绘标记维持，
    // 下次 ⌘F 会带回上次的查询
    unlisteners.push(await listen("find:closing", () => undefined));
  } catch (e) {
    console.warn("查找事件桥初始化失败", e);
  }

  watch(
    [() => settings.theme, () => settings.accent],
    ([theme]) => {
      emitTo("find", "find:theme", { theme, accent: currentAccent() }).catch(() => undefined);
      invoke("set_find_theme", { dark: theme === "dark" }).catch(() => undefined);
    }
  );
}

export function disposeFindBridge() {
  unlisteners.forEach((fn) => fn());
  unlisteners = [];
  initialized = false;
}
