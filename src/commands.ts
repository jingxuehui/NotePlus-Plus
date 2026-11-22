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

export function saveSession(json: string): Promise<void> {
  return invoke("save_session", { json });
}

export function loadSession(): Promise<string | null> {
  return invoke("load_session");
}

export function clearSession(): Promise<void> {
  return invoke("clear_session");
}
