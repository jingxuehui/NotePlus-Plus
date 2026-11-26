import { EditorView } from "@codemirror/view";
import { Extension } from "@codemirror/state";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

// ---------- 深色主题 ----------
const darkHighlight = HighlightStyle.define([
  { tag: t.keyword, color: "#c792ea" },
  { tag: t.controlKeyword, color: "#c792ea" },
  { tag: t.moduleKeyword, color: "#c792ea" },
  { tag: t.operator, color: "#89ddff" },
  { tag: t.definitionKeyword, color: "var(--accent)" },
  { tag: t.number, color: "#f78c6c" },
  { tag: t.bool, color: "#ff5865" },
  { tag: t.null, color: "#ff5865" },
  { tag: t.string, color: "#c3e88d" },
  { tag: t.special(t.string), color: "#c3e88d" },
  { tag: t.escape, color: "#89ddff" },
  { tag: t.comment, color: "#5c6370", fontStyle: "italic" },
  { tag: t.lineComment, color: "#5c6370", fontStyle: "italic" },
  { tag: t.blockComment, color: "#5c6370", fontStyle: "italic" },
  { tag: t.function(t.variableName), color: "var(--accent)" },
  { tag: t.function(t.propertyName), color: "var(--accent)" },
  { tag: t.className, color: "#ffcb6b" },
  { tag: t.typeName, color: "#ffcb6b" },
  { tag: t.tagName, color: "#f07178" },
  { tag: t.attributeName, color: "#ffcb6b" },
  { tag: t.variableName, color: "#d4d4d4" },
  { tag: t.propertyName, color: "#d4d4d4" },
  { tag: t.definition(t.propertyName), color: "var(--accent)" },
  { tag: t.constant(t.variableName), color: "var(--accent)" },
  { tag: t.regexp, color: "#89ddff" },
  { tag: t.link, color: "#89ddff", textDecoration: "underline" },
  { tag: t.heading, color: "var(--accent)", fontWeight: "bold" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strong, fontWeight: "bold" },
  { tag: t.invalid, color: "#ff5865" },
]);

export function darkTheme(): Extension {
  return [
    EditorView.theme(
      {
        "&": {
          color: "var(--text)",
          backgroundColor: "var(--panel)",
        },
        ".cm-content": { caretColor: "var(--accent)", fontFamily: "'SF Mono', Menlo, Monaco, 'Courier New', monospace" },
        ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--accent)" },
        "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
          { backgroundColor: "var(--selection-bg, #4fc3f78c)" },
        ".cm-activeLine": { backgroundColor: "var(--hover)" },
        ".cm-gutters": {
          // 行号区比编辑区略深，右侧一条浅分隔线贯穿到底部（均随强调色变化）
          backgroundColor: "var(--gutter)",
          color: "#5c6370",
          border: "none",
          borderRight: "1px solid var(--border)",
          height: "100%",
        },
        ".cm-activeLineGutter": {
          backgroundColor: "var(--hover)",
          color: "var(--text)",
        },
        ".cm-lineNumbers .cm-gutterElement": { padding: "0 12px 0 16px" },
        ".np-match": {
          backgroundColor: "rgba(249, 196, 89, 0.45)",
          outline: "1px solid rgba(249, 196, 89, 1)",
          borderRadius: "2px",
        },
        ".np-match-current": {
          backgroundColor: "rgba(249, 196, 89, 0.80)",
          outline: "1px solid #ffd479",
          borderRadius: "2px",
          color: "#16171c",
        },
        ".cm-panels": { backgroundColor: "var(--panel-2)", color: "var(--text)" },
        ".cm-tooltip": {
          backgroundColor: "var(--hover)",
          border: "1px solid var(--border)",
          borderRadius: "6px",
        },
        ".cm-foldPlaceholder": { backgroundColor: "#31415f", border: "none", color: "#9aa4b8" },
      },
      { dark: true }
    ),
    syntaxHighlighting(darkHighlight),
  ];
}

// ---------- 浅色主题 ----------
const lightHighlight = HighlightStyle.define([
  { tag: t.keyword, color: "#af26bf" },
  { tag: t.controlKeyword, color: "#af26bf" },
  { tag: t.moduleKeyword, color: "#af26bf" },
  { tag: t.operator, color: "#0d78bd" },
  { tag: t.definitionKeyword, color: "var(--accent)" },
  { tag: t.number, color: "#c25a1b" },
  { tag: t.bool, color: "#bf1c2e" },
  { tag: t.null, color: "#bf1c2e" },
  { tag: t.string, color: "#3a7d13" },
  { tag: t.special(t.string), color: "#3a7d13" },
  { tag: t.escape, color: "#0d78bd" },
  { tag: t.comment, color: "#8a9099", fontStyle: "italic" },
  { tag: t.lineComment, color: "#8a9099", fontStyle: "italic" },
  { tag: t.blockComment, color: "#8a9099", fontStyle: "italic" },
  { tag: t.function(t.variableName), color: "var(--accent)" },
  { tag: t.function(t.propertyName), color: "var(--accent)" },
  { tag: t.className, color: "#a2590a" },
  { tag: t.typeName, color: "#a2590a" },
  { tag: t.tagName, color: "#bf1c2e" },
  { tag: t.attributeName, color: "#a2590a" },
  { tag: t.variableName, color: "#2d3138" },
  { tag: t.propertyName, color: "#2d3138" },
  { tag: t.definition(t.propertyName), color: "var(--accent)" },
  { tag: t.constant(t.variableName), color: "var(--accent)" },
  { tag: t.regexp, color: "#0d78bd" },
  { tag: t.link, color: "#0d78bd", textDecoration: "underline" },
  { tag: t.heading, color: "var(--accent)", fontWeight: "bold" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strong, fontWeight: "bold" },
  { tag: t.invalid, color: "#bf1c2e" },
]);

export function lightTheme(): Extension {
  return [
    EditorView.theme(
      {
        "&": {
          color: "var(--text)",
          backgroundColor: "var(--panel)",
        },
        ".cm-content": { caretColor: "var(--accent)", fontFamily: "'SF Mono', Menlo, Monaco, 'Courier New', monospace" },
        ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--accent)" },
        "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
          { backgroundColor: "var(--selection-bg, #0b6cb54d)" },
        ".cm-activeLine": { backgroundColor: "var(--panel-2)" },
        ".cm-gutters": {
          // 行号区比编辑区略深，右侧一条浅分隔线贯穿到底部（均随强调色变化）
          backgroundColor: "var(--gutter)",
          color: "#9aa2ad",
          border: "none",
          borderRight: "1px solid var(--border)",
          height: "100%",
        },
        ".cm-activeLineGutter": { backgroundColor: "var(--panel-2)", color: "var(--text)" },
        ".cm-lineNumbers .cm-gutterElement": { padding: "0 12px 0 16px" },
        ".np-match": {
          backgroundColor: "rgba(240, 165, 30, 0.52)",
          outline: "1px solid rgba(214, 132, 20, 1)",
          borderRadius: "2px",
        },
        ".np-match-current": {
          backgroundColor: "rgba(240, 165, 30, 0.90)",
          outline: "1px solid #d97f10",
          borderRadius: "2px",
          color: "#1a1a1a",
        },
        ".cm-panels": { backgroundColor: "var(--panel-2)", color: "var(--text)" },
        ".cm-tooltip": {
          backgroundColor: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: "6px",
        },
        ".cm-foldPlaceholder": { backgroundColor: "#cfe1f7", border: "none", color: "#5c6773" },
      },
      { dark: false }
    ),
    syntaxHighlighting(lightHighlight),
  ];
}
