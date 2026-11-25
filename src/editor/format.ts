import { viewRef } from "@/editor/view";
import { notify } from "@/stores/toast";
import { t } from "@/i18n";

/**
 * 格式化当前文档中的 JSON：
 * - 用 2 空格缩进重新排版，保留 BOM 与结尾换行
 * - 内容不是合法 JSON 时提示错误位置，不改动文档
 */
export function formatJsonDocument() {
  const view = viewRef.current;
  if (!view) return;

  const text = view.state.doc.toString();
  if (!text.trim()) {
    notify(t("fmt.empty"), true);
    return;
  }

  const bom = text.startsWith("\uFEFF") ? "\uFEFF" : "";
  const body = bom ? text.slice(1) : text;
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch (e) {
    notify(t("fmt.error", { msg: (e as Error).message }), true);
    return;
  }

  const trailing = text.endsWith("\n") ? "\n" : "";
  const formatted = bom + JSON.stringify(parsed, null, 2) + trailing;
  if (formatted === text) {
    notify(t("fmt.already"), false);
    return;
  }

  const sel = view.state.selection.main;
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: formatted },
    selection: {
      anchor: Math.min(sel.from, formatted.length),
      head: Math.min(sel.to, formatted.length),
    },
  });
  view.focus();
  notify(t("fmt.done"), false);
}
