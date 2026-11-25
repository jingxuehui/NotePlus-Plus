/**
 * 平台检测与快捷键显示适配。
 * macOS 使用 ⌘/⇧/⌥ 系符号；Windows 显示 Ctrl+/Shift+/Alt+ 组合。
 */

export const isMac = navigator.userAgent.includes("Mac");
export const isWindows = !isMac && navigator.userAgent.includes("Windows");

/** 把 macOS 快捷键符号转换为当前平台的写法（仅非 macOS 平台转换） */
export function convertShortcut(s: string): string {
  if (isMac) return s;
  return s.replace(/⇧/g, "Shift+").replace(/⌥/g, "Alt+").replace(/⌘/g, "Ctrl+");
}
