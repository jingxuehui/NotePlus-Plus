import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  highlightTrailingWhitespace,
} from "@codemirror/view";
import { EditorState, Compartment, Extension } from "@codemirror/state";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  toggleComment,
} from "@codemirror/commands";
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
  indentOnInput,
  indentUnit,
} from "@codemirror/language";
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from "@codemirror/autocomplete";
import { lintKeymap } from "@codemirror/lint";
import type { CursorInfo } from "@/types";
import { darkTheme, lightTheme } from "./themes";
import { matchHighlight } from "./matchHighlight";
import type { ThemeMode } from "@/stores/settings";
import { languageFor } from "./language";

export interface EditorHooks {
  getTheme: () => ThemeMode;
  getFontSize: () => number;
  getWordWrap: () => boolean;
  onDocChanged: () => void;
  onCursor: (info: CursorInfo) => void;
}

const wrapComp = new Compartment();
const appearanceComp = new Compartment();

export function buildExtensions(hooks: EditorHooks): Extension[] {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    foldGutter(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    indentUnit.of("    "),
    bracketMatching(),
    closeBrackets(),
    autocompletion(),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightTrailingWhitespace(),
    // 自绘匹配高亮：不依赖内置查找面板，关闭查找窗口后仍然保持
    matchHighlight,
    keymap.of([
      { key: "Mod-/", run: toggleComment },
      // 查找快捷键（⌘F / ⌘G / ⌘⇧G / F3）统一由 App 层处理，编辑器不注册，避免弹出内置面板
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...completionKeymap,
      ...lintKeymap,
      indentWithTab,
    ]),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) hooks.onDocChanged();
      if (update.docChanged || update.selectionSet || update.focusChanged) {
        const state = update.state;
        const head = state.selection.main.head;
        const line = state.doc.lineAt(head);
        hooks.onCursor({
          line: line.number,
          col: head - line.from + 1,
          selected: Math.abs(state.selection.main.to - state.selection.main.from),
          lines: state.doc.lines,
          chars: state.doc.length,
        });
      }
    }),
    wrapComp.of(hooks.getWordWrap() ? EditorView.lineWrapping : []),
    appearanceComp.of([
      hooks.getTheme() === "dark" ? darkTheme() : lightTheme(),
      EditorView.theme({ "&": { fontSize: `${hooks.getFontSize()}px` } }),
    ]),
  ];
}

/** 切换换行 / 主题 / 字号时重新配置视图外观 */
export function reconfigureAppearance(view: EditorView, hooks: EditorHooks) {
  view.dispatch({
    effects: [
      wrapComp.reconfigure(hooks.getWordWrap() ? EditorView.lineWrapping : []),
      appearanceComp.reconfigure([
        hooks.getTheme() === "dark" ? darkTheme() : lightTheme(),
        EditorView.theme({ "&": { fontSize: `${hooks.getFontSize()}px` } }),
      ]),
    ],
  });
}

/** 为某个标签页创建 EditorState */
export function createStateForFile(path: string | null, content: string, hooks: EditorHooks): EditorState {
  const lang = path ? languageFor(path) : null;
  const base = buildExtensions(hooks);
  return EditorState.create({
    doc: content,
    extensions: lang ? [...base, lang] : base,
  });
}
