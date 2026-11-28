import { EditorSelection, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
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

/**
 * CodeMirror 默认三击选行会把行尾换行符一并选入（to++），导致选区 head 落到下一行行首。
 * 这里覆盖鼠标选择样式：三击时选区止于当前（视觉）行末尾，光标停在本行末尾。
 * 单击 / 双击 / Alt 列块选择仍由 CodeMirror 默认逻辑处理。
 */
export const selectLineToEOL: Extension = EditorView.mouseSelectionStyle.of((view, event) => {
  if (event.button !== 0 || event.altKey || event.detail < 3) return null;

  const start = view.posAndSideAtCoords({ x: event.clientX, y: event.clientY }, false);
  let startSel = view.state.selection;

  const rangeAt = (pos: number) => {
    const block = view.lineBlockAt(pos);
    const line = view.state.doc.lineAt(pos);
    return {
      from: Math.max(block.from, line.from),
      to: Math.min(block.to, line.to),
    };
  };

  return {
    update(update) {
      if (update.docChanged) {
        start.pos = update.changes.mapPos(start.pos);
        startSel = startSel.map(update.changes);
      }
    },
    get(curEvent, extend, multiple) {
      const cur = view.posAndSideAtCoords({ x: curEvent.clientX, y: curEvent.clientY }, false);
      const curRange = rangeAt(cur.pos);
      let from = curRange.from;
      let to = curRange.to;
      if (start.pos !== cur.pos) {
        const startRange = rangeAt(start.pos);
        from = Math.min(startRange.from, from);
        to = Math.max(startRange.to, to);
      }
      const range = EditorSelection.undirectionalRange(from, to);
      if (extend) return startSel.replaceRange(startSel.main.extend(from, to, range.assoc));
      if (multiple) return startSel.addRange(range);
      return EditorSelection.create([range]);
    },
  };
});
