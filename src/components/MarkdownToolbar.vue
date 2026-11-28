<script setup lang="ts">
import { computed } from "vue";
import { viewRef } from "@/editor/view";
import { ui, cycleMdPreview, type MdPreviewMode } from "@/stores/ui";
import { t } from "@/i18n";
import { isMac } from "@/utils/platform";

/**
 * Markdown 编辑区顶部工具面板：所有操作直接作用于当前 CodeMirror 文档，
 * 选区为空时插入占位文本并选中，方便直接输入。
 */

interface Btn {
  key: string;
  /** 按钮上的短文本（用符号/缩写，避免一堆图标资源） */
  text: string;
  run: () => void;
  cls?: string;
  /** 前面插入分组分隔线 */
  sep?: boolean;
}

function apply(
  changes: { from: number; to: number; insert: string }[] | { from: number; to: number; insert: string },
  selection?: { anchor: number; head?: number },
) {
  const v = viewRef.current;
  if (!v) return;
  v.dispatch({ changes, selection, scrollIntoView: true });
  v.focus();
}

/** 包裹选区（粗体/斜体/删除线/行内代码/链接/图片） */
function wrap(before: string, after: string, placeholder: string) {
  const v = viewRef.current;
  if (!v) return;
  const { from, to } = v.state.selection.main;
  const text = v.state.sliceDoc(from, to) || placeholder;
  apply(
    { from, to, insert: `${before}${text}${after}` },
    { anchor: from + before.length, head: from + before.length + text.length },
  );
}

/** 给选区涉及的每一行切换行首前缀：重复点击取消；标题/列表/引用之间互斥替换 */
type PrefixKind = "heading" | "bullet" | "ordered" | "task" | "quote";
function toggleLinePrefix(prefix: string, kind: PrefixKind) {
  const v = viewRef.current;
  if (!v) return;
  const { from, to } = v.state.selection.main;
  const first = v.state.doc.lineAt(from).number;
  const last = v.state.doc.lineAt(to).number;
  const pattern: Record<PrefixKind, RegExp> = {
    heading: /^#{1,6}\s+/,
    bullet: /^[-*+]\s+/,
    ordered: /^\d+\.\s+/,
    task: /^- \[[ xX]\]\s+/,
    quote: /^>\s+/,
  };
  const changes: { from: number; to: number; insert: string }[] = [];
  let index = 0;
  for (let n = first; n <= last; n++) {
    const line = v.state.doc.line(n);
    const existing = line.text.match(pattern[kind])?.[0] ?? "";
    // 有序列表的序号逐行递增，只要已有编号就视为重复点击（取消），不按字面比较
    const same = kind === "ordered" ? existing.length > 0 : existing === prefix;
    const next = kind === "ordered" ? `${++index}. ` : prefix;
    changes.push({ from: line.from, to: line.from + existing.length, insert: same ? "" : next });
  }
  apply(changes);
}

/** 在光标处插入块级模板（代码块 / 表格 / 分割线） */
function insertBlock(text: string) {
  const v = viewRef.current;
  if (!v) return;
  const { from, to } = v.state.selection.main;
  const insert = `\n\n${text}\n`;
  apply({ from, to, insert }, { anchor: from + insert.length });
}

const CODE_FENCE = "```\n\n```";
const TABLE = "| 列 1 | 列 2 |\n| ---- | ---- |\n| 内容 | 内容 |";

const groups: Btn[][] = [
  [
    { key: "h1", text: "H1", run: () => toggleLinePrefix("# ", "heading"), sep: false },
    { key: "h2", text: "H2", run: () => toggleLinePrefix("## ", "heading") },
    { key: "h3", text: "H3", run: () => toggleLinePrefix("### ", "heading") },
  ],
  [
    { key: "bold", text: "B", cls: "bold", run: () => wrap("**", "**", "粗体文本"), sep: true },
    { key: "italic", text: "I", cls: "italic", run: () => wrap("*", "*", "斜体文本") },
    { key: "strike", text: "S", cls: "strike", run: () => wrap("~~", "~~", "删除线") },
    { key: "inlineCode", text: "</>", cls: "mono", run: () => wrap("`", "`", "代码") },
  ],
  [
    { key: "link", text: "[]", cls: "mono", run: () => wrap("[", "](url)", "链接文字"), sep: true },
    { key: "image", text: "![]", cls: "mono", run: () => wrap("![", "](path)", "图片说明") },
  ],
  [
    { key: "bullet", text: "•", run: () => toggleLinePrefix("- ", "bullet"), sep: true },
    { key: "ordered", text: "1.", cls: "mono", run: () => toggleLinePrefix("1. ", "ordered") },
    { key: "task", text: "[✓]", cls: "mono", run: () => toggleLinePrefix("- [ ] ", "task") },
    { key: "quote", text: ">", cls: "mono", run: () => toggleLinePrefix("> ", "quote") },
  ],
  [
    { key: "codeBlock", text: "{ }", cls: "mono", run: () => insertBlock(CODE_FENCE), sep: true },
    { key: "table", text: "▦", run: () => insertBlock(TABLE) },
    { key: "hr", text: "—", run: () => insertBlock("---") },
  ],
];

const canFormat = computed(() => ui.mdPreview !== "preview");
/** 原菜单栏预览按钮的提示迁移到这里：⇧⌘V 循环切换三种模式 */
const previewTip = computed(() => `${t("titlebar.preview")} (${isMac ? "⇧⌘V" : "Ctrl+Shift+V"})`);
/** 当前模式对应的图标路径（随模式变化的单按钮） */
const modeIcon: Record<MdPreviewMode, { path: string; extra?: string; circle?: boolean }> = {
  edit: { path: "M2 8h4l2-4 2.5 8 2-4h3.5" },
  preview: { path: "M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z", circle: true },
  split: { path: "M2.5 2.5v11M6.5 2.5v11" },
};
</script>

<template>
  <div class="md-toolbar">
    <template v-if="canFormat">
      <template v-for="(group, gi) in groups">
        <span v-if="gi > 0" :key="`sep-${gi}`" class="md-sep"></span>
        <button
          v-for="btn in group"
          :key="btn.key"
          class="md-btn"
          :class="btn.cls"
          type="button"
          :title="t(`mdToolbar.${btn.key}`)"
          @mousedown.prevent
          @click="btn.run"
        >
          {{ btn.text }}
        </button>
      </template>
    </template>

    <!-- 预览切换：编辑 / 全屏预览 / 分屏循环（原菜单栏按钮迁移至此） -->
    <button
      class="md-mode-btn"
      :class="{ active: ui.mdPreview !== 'edit' }"
      type="button"
      :title="previewTip"
      @mousedown.prevent
      @click="cycleMdPreview"
    >
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
        <path :d="modeIcon[ui.mdPreview].path" />
        <circle v-if="modeIcon[ui.mdPreview].circle" cx="8" cy="8" r="1.6" />
        <template v-if="ui.mdPreview === 'split'">
          <path d="M9.5 4.5h4" />
          <path d="M9.5 7h4" />
          <path d="M9.5 9.5h4" />
        </template>
      </svg>
    </button>
  </div>
</template>

<style scoped>
.md-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 38px;
  padding: 0 10px;
  background: var(--chrome);
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  user-select: none;
}
.md-toolbar::-webkit-scrollbar { display: none; }

.md-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 26px;
  padding: 0 5px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--muted);
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  flex-shrink: 0;
}
.md-btn:hover {
  background: var(--hover);
  color: var(--text);
}
.md-btn:active {
  background: var(--accent-tint);
  color: var(--accent);
}
.md-btn.bold { font-weight: 800; }
.md-btn.italic { font-style: italic; font-family: Georgia, serif; font-size: 14px; }
.md-btn.strike { text-decoration: line-through; }
.md-btn.mono { font-family: var(--editor-font, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace); font-size: 11px; }

.md-sep {
  width: 1px;
  height: 16px;
  margin: 0 6px;
  background: var(--border);
  flex-shrink: 0;
}

/* 预览切换按钮：靠右，随模式显示不同图标，激活（非编辑模式）时高亮 */
.md-mode-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 26px;
  margin-left: auto;
  /* 离窗口右边缘留出空间，悬停气泡不再被挤偏 */
  margin-right: 16px;
  flex-shrink: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
}
.md-mode-btn:hover { background: var(--hover); color: var(--text); }
.md-mode-btn.active {
  background: var(--accent-tint);
  color: var(--accent);
}
</style>
