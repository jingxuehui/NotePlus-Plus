import { invoke } from "@tauri-apps/api/core";

export interface TextFileInfo {
  content: string;
  encoding: string;
  eol: string;
  size: number;
}

export interface WriteResult {
  bytes_written: number;
}

export interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  children: FileNode[] | null;
  size?: number;
}

export function readTextFile(path: string): Promise<TextFileInfo> {
  return invoke("read_text_file", { path });
}

export function writeTextFile(
  path: string,
  content: string,
  encoding: string,
  eol: string
): Promise<WriteResult> {
  return invoke("write_text_file", { path, content, encoding, eol });
}

export function readDirTree(
  path: string,
  depth: number,
  showHidden: boolean
): Promise<FileNode> {
  return invoke("read_dir_tree", { path, depth, showHidden });
}

export function revealInFinder(path: string): Promise<void> {
  return invoke("reveal_in_finder", { path });
}

/** 用系统默认浏览器打开外部链接 */
export function openExternal(url: string): Promise<void> {
  return invoke("open_external", { url });
}

export function saveSession(json: string): Promise<void> {
  return invoke("save_session", { json });
}

export function loadSession(): Promise<string | null> {
  return invoke("load_session");
}

export function clearSession(): Promise<void> {
  return invoke("clear_session");
}

/** 同步「关闭窗口时退出程序」设置到 Rust 侧 */
export function setExitOnClose(enabled: boolean): Promise<void> {
  return invoke("set_exit_on_close", { enabled });
}

/** 切换 Dock 图标：默认彩色 / 黑色底板 */
export function setIconStyle(black: boolean): Promise<void> {
  return invoke("set_icon_style", { black });
}
