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

/** 自定义原生保存对话框（Windows 上避免插件对话框跨线程 owner 导致卡死/闪退） */
export function nativeSaveFile(title: string, defaultPath?: string): Promise<string | null> {
  return invoke("np_save_file", { title, defaultPath: defaultPath ?? null });
}

/** 自定义原生打开对话框：返回选中的文件 / 文件夹路径 */
export function nativeOpenPaths(
  title: string,
  multiple: boolean,
  directory: boolean
): Promise<string[] | null> {
  return invoke("np_open_dialog", { title, multiple, directory });
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

export interface ReleaseAsset {
  name: string;
  size: number;
  downloadUrl: string;
}

export interface ReleaseInfo {
  tag: string;
  name: string;
  body: string;
  publishedAt: string;
  htmlUrl: string;
  prerelease: boolean;
  assets: ReleaseAsset[];
}

export interface DownloadedAsset {
  path: string;
  name: string;
  size: number;
}

/** 从 GitHub / Gitee 拉取 releases 发布说明 */
export function fetchReleases(source: string): Promise<ReleaseInfo[]> {
  return invoke("fetch_releases", { source });
}

/** 下载 release 安装包到应用缓存目录 */
export function downloadAsset(url: string, name: string): Promise<DownloadedAsset> {
  return invoke("download_asset", { url, name });
}

/** 打开安装包并退出应用 */
export function restartAndUpdate(path: string): Promise<void> {
  return invoke("restart_and_update", { path });
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

/** 同步应用语言到 Rust（写入 macOS AppleLanguages，重启后原生 UI 跟随） */
export function setAppLanguage(lang: string): Promise<void> {
  return invoke("set_app_language", { lang });
}
