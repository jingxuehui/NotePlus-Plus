/**
 * 平台检测与快捷键显示适配。
 * macOS 使用 ⌘/⇧/⌥ 系符号；Windows 显示 Ctrl+/Shift+/Alt+ 组合。
 */

export const isMac = navigator.userAgent.includes("Mac");
export const isWindows = !isMac && navigator.userAgent.includes("Windows");

/** 判断字符是否为 macOS 修饰键符号 */
function isModifier(ch: string): boolean {
  return ch === "⌘" || ch === "⌃" || ch === "⌥" || ch === "⇧";
}

/**
 * 把 macOS 快捷键拆成当前平台的按键序列，用于逐个渲染键帽。
 * 返回二维数组：外层为 " / " 分隔的多组，内层为该组的每个键。
 * 例如 ⇧⌘P 在 mac 下为 [["⇧", "⌘", "P"]]，在 Windows 下为 [["Ctrl", "Shift", "P"]]。
 */
export function shortcutKeys(s: string): string[][] {
  return s.split(" / ").map((part) => {
    if (isMac) {
      const keys: string[] = [];
      let key = "";
      for (const ch of part) {
        if (isModifier(ch)) {
          if (key) {
            keys.push(key);
            key = "";
          }
          keys.push(ch);
        } else {
          key += ch;
        }
      }
      if (key) keys.push(key);
      return keys;
    }
    let ctrl = false;
    let shift = false;
    let alt = false;
    let key = "";
    for (const ch of part) {
      if (ch === "⌘" || ch === "⌃") ctrl = true;
      else if (ch === "⇧") shift = true;
      else if (ch === "⌥") alt = true;
      else key += ch;
    }
    const mods = [ctrl ? "Ctrl" : "", shift ? "Shift" : "", alt ? "Alt" : ""].filter(Boolean);
    return key ? [...mods, key] : mods;
  });
}

/** 把 macOS 快捷键符号转换为当前平台的文本写法（仅非 macOS 平台转换） */
export function convertShortcut(s: string): string {
  if (isMac) return s;
  return shortcutKeys(s)
    .map((keys) => keys.join("+"))
    .join(" / ");
}
