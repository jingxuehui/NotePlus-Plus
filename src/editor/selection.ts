import { EditorSelection, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
  foldAll,
  unfoldAll,
  toggleFold,
  foldable,
  foldedRanges,
} from "@codemirror/language";
import { viewRef } from "./view";

/**
 * 多光标 / 列块选择 / 代码折叠 的命令集合。
 * 底层能力（allowMultipleSelections、rectangularSelection、foldGutter）在 setup.ts 已启用，
 * 这里补齐显式操作入口，供快捷键、右键菜单和命令面板调用。
 */

/** 在上一行 / 下一行相同列位置添加光标 */
export function addCursorAbove(): boolean {
  const view = viewRef.current;
  if (!view) return false;
  return addCursorAtLine(view, -1);
}

export function addCursorBelow(): boolean {
  const view = viewRef.current;
  if (!view) return false;
  return addCursorAtLine(view, 1);
}

function addCursorAtLine(view: EditorView, dir: -1 | 1): boolean {
  const state = view.state;
  const ranges = state.selection.ranges;
  const last = ranges[ranges.length - 1];
  const head = last.head;
  const line = state.doc.lineAt(head);
  const col = head - line.from;
  const targetLineNo = line.number + dir;
  if (targetLineNo < 1 || targetLineNo > state.doc.lines) return true;
  const targetLine = state.doc.line(targetLineNo);
  const pos = Math.min(targetLine.from + col, targetLine.to);
  if (ranges.some((r) => r.head === pos)) return true;
  view.dispatch({
    selection: EditorSelection.create([
      ...ranges,
      EditorSelection.cursor(pos),
    ]),
    scrollIntoView: true,
  });
  view.focus();
  return true;
}

/** 选中文档中所有与当前选区内容相同的出现位置 */
export function selectAllOccurrences(): boolean {
  const view = viewRef.current;
  if (!view) return false;
  const state = view.state;
  const main = state.selection.main;
  let text: string;
  if (!main.empty) {
    text = state.sliceDoc(main.from, main.to);
  } else {
    const line = state.doc.lineAt(main.head);
    const before = state.sliceDoc(line.from, main.head);
    const after = state.sliceDoc(main.head, line.to);
    const left = before.match(/[\w$]+$/)?.[0] ?? "";
    const right = after.match(/^[\w$]+/)?.[0] ?? "";
    text = left + right;
    if (!text) return false;
  }
  if (!text) return false;
  const ranges = [];
  const re = new RegExp(escapeRegExp(text), "g");
  const content = state.doc.toString();
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    ranges.push(EditorSelection.range(m.index, m.index + text.length));
  }
  if (!ranges.length) return false;
  view.dispatch({
    selection: EditorSelection.create(ranges, Math.min(1, ranges.length - 1)),
    scrollIntoView: true,
  });
  view.focus();
  return true;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 切换列块选择模式（通过 dispatch 设置 rectangular 选择标记） */
export function toggleColumnSelection(): boolean {
  const view = viewRef.current;
  if (!view) return false;
  // CodeMirror 的矩形选择通过 Alt/Option + 拖动实现；此处提供「把当前多选区转为列块」的入口
  const ranges = view.state.selection.ranges;
  if (ranges.length < 2) return false;
  const lines = ranges.map((r) => view.state.doc.lineAt(r.head).number);
  const minLine = Math.min(...lines);
  const maxLine = Math.max(...lines);
  const col = ranges[0].head - view.state.doc.line(minLine).from;
  const newRanges = [];
  for (let n = minLine; n <= maxLine; n++) {
    const line = view.state.doc.line(n);
    newRanges.push(EditorSelection.cursor(Math.min(line.from + col, line.to)));
  }
  view.dispatch({ selection: EditorSelection.create(newRanges) });
  view.focus();
  return true;
}

export function foldAllLines(): boolean {
  const view = viewRef.current;
  if (!view) return false;
  foldAll(view);
  return true;
}

export function unfoldAllLines(): boolean {
  const view = viewRef.current;
  if (!view) return false;
  unfoldAll(view);
  return true;
}

export function toggleFoldAtCursor(): boolean {
  const view = viewRef.current;
  if (!view) return false;
  const pos = view.state.selection.main.head;
  if (!foldable(view.state, pos, pos)) return false;
  toggleFold(view);
  return true;
}

/** 统计当前已折叠区域数量（供状态栏显示） */
export function countFolded(): number {
  const view = viewRef.current;
  if (!view) return 0;
  let count = 0;
  const iter = foldedRanges(view.state).iter();
  while (iter.value) {
    count++;
    iter.next();
  }
  return count;
}

/**
 * Option/Alt + 单击添加光标（VS Code 风格多光标）。
 *
 * 直接复用 CodeMirror 内置的 clickAddsSelectionRange facet（走原生鼠标选择流程，不闪动）。
 * 覆盖默认值：macOS 默认的 Cmd+点击 / Windows 默认的 Ctrl+点击不再添加光标，仅 Alt+点击生效。
 * Alt+拖动仍由 rectangularSelection 处理为列块选择，两者互不干扰。
 */
export const altClickAddCursor: Extension = EditorView.clickAddsSelectionRange.of(
  (event: MouseEvent) => event.altKey && event.button === 0
);
