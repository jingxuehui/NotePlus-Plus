/** 取路径最后一段（文件名 / 文件夹名），同时兼容 macOS 的 / 与 Windows 的 \ 分隔符 */
export function baseName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}
