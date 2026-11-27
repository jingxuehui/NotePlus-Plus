import { reactive } from "vue";
import { EditorSelection, type ChangeSpec } from "@codemirror/state";
import { SearchQuery } from "@codemirror/search";
import { EditorView } from "@codemirror/view";
import { viewRef } from "@/editor/view";
import { setMatchHighlight } from "@/editor/matchHighlight";

/**
 * 编辑器内嵌查找面板（对齐 dbx 的 EditorSearchPanel）。
 * 查找、替换、计数全部在主窗口直接操作 EditorView，
 * 不再使用独立 Tauri 窗口 / 跨窗口事件桥。
 */

export const MATCH_LIMIT = 5000;

export const findState = reactive({
  visible: false,
  showReplace: false,
  search: "",
  replace: "",
  caseSensitive: false,
  regexp: false,
  wholeWord: false,
  matchCount: 0,
  currentIndex: 0,
  inSelectionScope: false,
  selectionLimitReached: false,
});

/** 多行选区限定的查找范围 */
let scopeFrom: number | null = null;
let scopeTo: number | null = null;

export interface FindMatch {
  from: number;
  to: number;
}

function makeQuery(): SearchQuery {
  return new SearchQuery({
    search: findState.search,
    replace: findState.replace,
    caseSensitive: findState.caseSensitive,
    regexp: findState.regexp,
    literal: !findState.regexp,
    wholeWord: findState.wholeWord,
  });
}

function matchesInScope(view: EditorView, q: SearchQuery, from = 0, to = view.state.doc.length): FindMatch[] {
  const out: FindMatch[] = [];
  try {
    const cursor = q.getCursor(view.state);
    for (let r = cursor.next(); !r.done; r = cursor.next()) {
      if (r.value.from < from || r.value.to > to) continue;
      out.push({ from: r.value.from, to: r.value.to });
      if (out.length >= MATCH_LIMIT) break;
    }
  } catch {
    /* 非法正则 */
  }
  return out;
}

function allMatches(view: EditorView): FindMatch[] {
  if (!findState.search) return [];
  const q = makeQuery();
  if (!q.valid) return [];
  return matchesInScope(view, q, scopeFrom ?? 0, scopeTo ?? view.state.doc.length);
}

/** 正则替换支持 $1 / $2 / $& 捕获组 */
function replacementFor(view: EditorView, match: FindMatch): string {
  if (!findState.regexp) return findState.replace;
  const text = view.state.sliceDoc(match.from, match.to);
  try {
    const re = new RegExp(findState.search, findState.caseSensitive ? "" : "i");
    const m = re.exec(text);
    if (!m) return findState.replace;
    return findState.replace.replace(/\$(\d+|&)/g, (_, ref: string) => {
      if (ref === "&") return m[0];
      const idx = parseInt(ref, 10);
      return idx < m.length ? (m[idx] ?? "") : `$${ref}`;
    });
  } catch {
    return findState.replace;
  }
}

/** 重新计算计数与当前匹配序号，并刷新高亮 */
function refresh(autoSelect = false) {
  const view = viewRef.current;
  if (!view) {
    findState.matchCount = 0;
    findState.currentIndex = 0;
    return;
  }
  if (!findState.search) {
    view.dispatch({ effects: setMatchHighlight.of(null) });
    findState.matchCount = 0;
    findState.currentIndex = 0;
    return;
  }
  const q = makeQuery();
  view.dispatch({ effects: setMatchHighlight.of(q.valid ? q : null) });
  if (autoSelect && q.valid) selectMatch(1, false);
  const list = allMatches(view);
  findState.matchCount = list.length;
  const sel = view.state.selection.main;
  let idx = 0;
  for (let i = 0; i < list.length; i++) {
    const m = list[i];
    if ((sel.empty && m.from <= sel.from && sel.from <= m.to) || (!sel.empty && m.from <= sel.from && sel.to <= m.to)) {
      idx = i + 1;
      break;
    }
  }
  findState.currentIndex = idx || (list.length ? 1 : 0);
}

/** 选中下一个 / 上一个匹配（循环） */
function selectMatch(dir: 1 | -1, update = true) {
  const view = viewRef.current;
  if (!view) return;
  const list = allMatches(view);
  if (!list.length) return;
  const sel = view.state.selection.main;
  const target =
    dir > 0
      ? list.find((m) => m.from >= sel.to) ?? list[0]
      : [...list].reverse().find((m) => m.to <= sel.from) ?? list[list.length - 1];
  view.dispatch({
    selection: EditorSelection.range(target.from, target.to),
    effects: EditorView.scrollIntoView(target.from, { y: "center" }),
  });
  if (update) refresh();
}

/** 打开查找面板；多行选区自动作为限定范围 */
export function openFindPanel(replace = false) {
  const view = viewRef.current;
  findState.visible = true;
  findState.showReplace = replace || findState.showReplace;
  if (view) {
    const sel = view.state.selection.main;
    const text = view.state.sliceDoc(sel.from, sel.to);
    if (text && !sel.empty) {
      findState.search = text;
      if (text.includes("\n")) {
        scopeFrom = sel.from;
        scopeTo = sel.to;
        findState.inSelectionScope = true;
      } else {
        scopeFrom = null;
        scopeTo = null;
        findState.inSelectionScope = false;
      }
    }
    refresh(!!text);
  }
}

/** 关闭面板，清空匹配高亮，焦点回到编辑器 */
export function closeFindPanel() {
  if (!findState.visible) return;
  findState.visible = false;
  findState.showReplace = false;
  scopeFrom = null;
  scopeTo = null;
  findState.inSelectionScope = false;
  findState.selectionLimitReached = false;
  const view = viewRef.current;
  if (view) {
    view.dispatch({ effects: setMatchHighlight.of(null) });
    view.focus();
  }
}

export function nextMatch() {
  if (!findState.search) openFindPanel();
  else selectMatch(1);
}

export function prevMatch() {
  if (!findState.search) openFindPanel();
  else selectMatch(-1);
}

/** 查询条件变化时由面板调用 */
export function onQueryChanged() {
  scopeFrom = null;
  scopeTo = null;
  findState.inSelectionScope = false;
  refresh(true);
}

/** 全部查找：选中所有匹配（上限 MATCH_LIMIT） */
export function selectAllMatches() {
  const view = viewRef.current;
  if (!view || !findState.search) return;
  const list = allMatches(view);
  findState.selectionLimitReached = list.length >= MATCH_LIMIT;
  if (!list.length) return;
  view.dispatch({
    selection: EditorSelection.create(list.map((m) => EditorSelection.range(m.from, m.to))),
    scrollIntoView: true,
  });
  refresh();
  view.focus();
}

/** 替换当前 / 下一个匹配 */
export function replaceOne() {
  const view = viewRef.current;
  if (!view || !findState.search) return;
  const list = allMatches(view);
  if (!list.length) return;
  const sel = view.state.selection.main;
  let target = list.find((m) => m.from <= sel.from && sel.to <= m.to);
  if (!target) target = list.find((m) => m.from >= sel.to) ?? list[0];
  const insert = replacementFor(view, target);
  const tr = view.state.update({
    changes: { from: target.from, to: target.to, insert },
    selection: EditorSelection.range(target.from, target.from + insert.length),
    scrollIntoView: true,
  });
  if (scopeFrom != null) scopeFrom = tr.changes.mapPos(scopeFrom);
  if (scopeTo != null) scopeTo = tr.changes.mapPos(scopeTo);
  view.dispatch(tr);
  const after = allMatches(view);
  const next = after.find((m) => m.from >= target.from + insert.length);
  if (next) {
    view.dispatch({
      selection: EditorSelection.range(next.from, next.to),
      effects: EditorView.scrollIntoView(next.from, { y: "center" }),
    });
  }
  refresh();
}

/** 全部替换 */
export function replaceAll() {
  const view = viewRef.current;
  if (!view || !findState.search) return;
  const list = allMatches(view);
  if (!list.length) return;
  const changes: ChangeSpec[] = list.map((m) => ({
    from: m.from,
    to: m.to,
    insert: replacementFor(view, m),
  }));
  const tr = view.state.update({ changes });
  if (scopeFrom != null) scopeFrom = tr.changes.mapPos(scopeFrom);
  if (scopeTo != null) scopeTo = tr.changes.mapPos(scopeTo);
  view.dispatch(tr);
  refresh();
}

/** 清除高亮但保留面板与查询 */
export function clearHighlights() {
  const view = viewRef.current;
  if (view) view.dispatch({ effects: setMatchHighlight.of(null) });
}

// ---- 兼容旧调用入口（App.vue / 工具栏 / 右键菜单无需改动） ----
export const openFindWindow = () => openFindPanel(false);
export const findNextMatch = () => nextMatch();
export const findPrevMatch = () => prevMatch();
export const initFindBridge = () => undefined;
export const disposeFindBridge = () => undefined;
