import { StateEffect, StateField, type Range } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import type { SearchQuery } from "@codemirror/search";

/**
 * 独立于 CodeMirror 内置查找面板的匹配高亮。
 * 内置 search() 的高亮依赖其内部查询状态，关闭面板/对话框后会被清空；
 * 这里自行保存查询并绘制标记，查找窗口关闭后高亮依然保持。
 */
export const setMatchHighlight = StateEffect.define<SearchQuery | null>();

export const matchHighlightField = StateField.define<SearchQuery | null>({
  create: () => null,
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setMatchHighlight)) return e.value;
    return value;
  },
});

const matchMark = Decoration.mark({ class: "np-match" });
const currentMark = Decoration.mark({ class: "np-match np-match-current" });

function buildDecorations(view: EditorView): DecorationSet {
  const q = view.state.field(matchHighlightField, false);
  if (!q || !q.valid || !q.search) return Decoration.none;

  const sel = view.state.selection.main;
  const ranges: Range<Decoration>[] = [];
  try {
    for (const { from, to } of view.visibleRanges) {
      const cursor = q.getCursor(view.state, from, to);
      for (let result = cursor.next(); !result.done; result = cursor.next()) {
        const m = result.value;
        const current = sel.empty
          ? m.from <= sel.from && sel.from <= m.to
          : m.from < sel.to && sel.from < m.to;
        ranges.push((current ? currentMark : matchMark).range(m.from, m.to));
      }
    }
  } catch {
    return Decoration.none;
  }
  return Decoration.set(ranges, true);
}

const matchHighlightPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate) {
      const queryChanged = update.transactions.some((tr) =>
        tr.effects.some((e) => e.is(setMatchHighlight))
      );
      if (update.docChanged || update.selectionSet || update.viewportChanged || queryChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);

export const matchHighlight = [matchHighlightField, matchHighlightPlugin];
