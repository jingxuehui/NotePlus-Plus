export interface Shortcut {
  k: string;
  /** Windows 下显示的组合键（缺省时复用 k，但 mac 符号会原样显示，故 mac 组合键都应提供 kw） */
  kw?: string;
  /** 非组合键（如「拖拽」）的按键列文字，为 i18n 键；提供时优先于 k / kw 显示 */
  keyLabel?: string;
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
  { k: "⌘N", kw: "Ctrl+N", label: "sc.new" },
  { k: "⌘O", kw: "Ctrl+O", label: "sc.open" },
  { k: "⇧⌘O", kw: "Ctrl+Shift+O", label: "sc.openFolder" },
  { k: "⌘S", kw: "Ctrl+S", label: "sc.save" },
  { k: "⌥⌘S", kw: "Ctrl+Alt+S", label: "sc.saveAll" },
  { k: "⌘W", kw: "Ctrl+W", label: "sc.closeTab" },
  { k: "⌘F", kw: "Ctrl+F", label: "sc.findWindow" },
  { k: "⌘G / ⇧⌘G", kw: "Ctrl+G / Ctrl+Shift+G", label: "sc.nextPrev" },
  { k: "⇧⌘P", kw: "Ctrl+Shift+P", label: "sc.commandPalette" },
  { k: "⌘P", kw: "Ctrl+P", label: "sc.quickOpen" },
  { k: "⌥⌘↑ / ⌥⌘↓", kw: "Ctrl+Alt+↑ / Ctrl+Alt+↓", label: "sc.multiCursor" },
  { k: "⇧⌘L", kw: "Ctrl+Shift+L", label: "sc.selectAllOccurrences" },
  { k: "⌥⌘[ / ⌥⌘]", kw: "Ctrl+Alt+[ / Ctrl+Alt+]", label: "sc.fold" },
  { k: "⌘B", kw: "Ctrl+B", label: "sc.sidebar" },
  { k: "⌘/", kw: "Ctrl+/", label: "sc.comment" },
  { k: "⇧⌥F", kw: "Shift+Alt+F", label: "sc.format" },
  { k: "⌘+ / ⌘- / ⌘0", kw: "Ctrl+= / Ctrl+- / Ctrl+0", label: "sc.zoom" },
  { k: "⌘,", kw: "Ctrl+,", label: "sc.settings" },
  { k: "drag", keyLabel: "sc.dragKey", label: "sc.drag" },
];
