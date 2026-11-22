import { watch } from "vue";
import { emitTo, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { EditorSelection, EditorState } from "@codemirror/state";
import {
  SearchQuery,
  setSearchQuery,
  findNext,
  findPrevious,
  replaceNext,
  replaceAll,
} from "@codemirror/search";
import { viewRef } from "@/editor/view";
import { settings } from "@/stores/settings";

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

function countFor(searchState: EditorState, q: SearchQuery): number {
  let count = 0;
  try {
    const cursor = q.getCursor(searchState);
    let result = cursor.next();
    while (!result.done && count < 99999) {
      count++;
      result = cursor.next();
    }
  } catch {
    return 0; // 非法正则
  }
  return count;
}

/** 把当前查询应用到编辑器，并回传匹配数量 */
function applyQuery() {
  const view = viewRef.current;
  if (!view) {
    sendCount(0);
    return;
  }
  if (!query.search) {
    view.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: "" })) });
    sendCount(0);
    return;
  }
  const q = makeQuery();
  view.dispatch({ effects: setSearchQuery.of(q) });
  sendCount(countFor(view.state, q));
}

function findAll() {
  const view = viewRef.current;
  if (!view || !query.search) return;
  const q = makeQuery();
  view.dispatch({ effects: setSearchQuery.of(q) });
  const ranges: ReturnType<typeof EditorSelection.range>[] = [];
  try {
    const cursor = q.getCursor(view.state);
    let result = cursor.next();
    while (!result.done) {
      ranges.push(EditorSelection.range(result.value.from, result.value.to));
      result = cursor.next();
    }
  } catch {
    /* 非法正则 */
  }
  sendCount(ranges.length);
  if (ranges.length) {
    view.dispatch({ selection: EditorSelection.create(ranges), scrollIntoView: true });
    view.focus();
  }
}

async function handleAction(action: string) {
  const view = viewRef.current;
  if (!view) return;
  switch (action) {
    case "next":
      applyQuery();
      findNext(view);
      view.focus();
      break;
    case "prev":
      applyQuery();
      findPrevious(view);
      view.focus();
      break;
    case "replace": {
      applyQuery();
      replaceNext(view);
      const q = makeQuery();
      sendCount(countFor(view.state, q));
      view.focus();
      break;
    }
    case "replaceAll": {
      applyQuery();
      replaceAll(view);
      const q = makeQuery();
      sendCount(countFor(view.state, q));
      view.focus();
      break;
    }
    case "findAll":
      findAll();
      break;
    case "clearHighlights": {
      view.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: "" })) });
      sendCount(0);
      break;
    }
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

    // 对话框加载完成后握手：回传选区、主题与上次的查询
    unlisteners.push(
      await listen("find:init", () => {
        emitTo("find", "find:state", {
          selection: selectedText(),
          theme: settings.theme,
          query,
        }).catch(() => undefined);
      })
    );

    unlisteners.push(
      await listen("find:selection-request", () => {
        emitTo("find", "find:selection", { text: selectedText() }).catch(() => undefined);
      })
    );

    unlisteners.push(
      await listen("find:closing", () => {
        // 只清理编辑器中的高亮，保留查询内容以便下次 ⌘F 恢复
        const view = viewRef.current;
        if (view) {
          view.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: "" })) });
        }
      })
    );
  } catch (e) {
    console.warn("查找事件桥初始化失败", e);
  }

  watch(
    () => settings.theme,
    (theme) => {
      emitTo("find", "find:theme", { theme }).catch(() => undefined);
      invoke("set_find_theme", { dark: theme === "dark" }).catch(() => undefined);
    }
  );
}

export function disposeFindBridge() {
  unlisteners.forEach((fn) => fn());
  unlisteners = [];
  initialized = false;
}
