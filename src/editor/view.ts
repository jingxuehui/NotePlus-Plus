import type { EditorView } from "@codemirror/view";

/** 当前 EditorView 的共享引用，供查找替换 / 保存等模块访问 */
export const viewRef: { current: EditorView | null } = { current: null };
