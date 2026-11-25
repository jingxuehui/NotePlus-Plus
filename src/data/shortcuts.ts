export interface Shortcut {
  k: string;
  label: string;
}

export interface ShortcutPart {
  text: string;
  sym: boolean;
}

const SYM_RE = /^[⌘⇧⌥⌃]$/;

/** 把 ⌘N / ⇧⌘O 拆成带 + 的分段，符号单独成段便于放大显示 */
export function shortcutParts(k: string): ShortcutPart[] {
  const out: ShortcutPart[] = [];
  for (let i = 0; i < k.length; i++) {
    const ch = k[i];
    const prev = k[i - 1] ?? "";
    const next = k[i + 1] ?? "";
    if (SYM_RE.test(ch)) {
      if (SYM_RE.test(prev)) out.push({ text: "+", sym: false });
      out.push({ text: ch, sym: true });
      if (next && !SYM_RE.test(next) && next !== "+" && next !== " ") {
        out.push({ text: "+", sym: false });
      }
    } else {
      out.push({ text: ch, sym: false });
    }
  }
  return out;
}

/** 全局快捷键说明：欢迎页与标题栏的快捷键提示共用同一份数据（label 为 i18n 键，渲染时经 t() 翻译） */
export const SHORTCUTS: Shortcut[] = [
  { k: "⌘N", label: "sc.new" },
  { k: "⌘O", label: "sc.open" },
  { k: "⇧⌘O", label: "sc.openFolder" },
  { k: "⌘S", label: "sc.save" },
  { k: "⌥⌘S", label: "sc.saveAll" },
  { k: "⌘W", label: "sc.closeTab" },
  { k: "⌘F", label: "sc.findWindow" },
  { k: "⌘G / ⇧⌘G", label: "sc.nextPrev" },
  { k: "⌘B", label: "sc.sidebar" },
  { k: "⌘/", label: "sc.comment" },
  { k: "⇧⌥F", label: "sc.format" },
  { k: "⌘+ / ⌘- / ⌘0", label: "sc.zoom" },
  { k: "⌘,", label: "sc.settings" },
  { k: "拖拽", label: "sc.drag" },
];
