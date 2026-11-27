import { reactive } from "vue";
import { readDirTree, type FileNode } from "@/commands";
import { baseName } from "@/utils/path";

interface TreeState {
  root: string | null;
  rootName: string;
  rootNode: FileNode | null;
  expanded: Set<string>;
  showHidden: boolean;
  loading: boolean;
}

export const treeState = reactive<TreeState>({
  root: null,
  rootName: "",
  rootNode: null,
  expanded: new Set<string>(),
  showHidden: false,
  loading: false,
});

export async function loadRoot(path: string): Promise<void> {
  treeState.loading = true;
  try {
    const node = await readDirTree(path, 2, treeState.showHidden);
    treeState.root = path;
    treeState.rootName = baseName(path);
    treeState.rootNode = node;
    treeState.expanded = new Set([path]);
    // 默认展开一级子目录
    for (const child of node.children ?? []) {
      if (child.is_dir) treeState.expanded.add(child.path);
    }
  } catch (e) {
    treeState.root = null;
    treeState.rootNode = null;
    throw e;
  } finally {
    treeState.loading = false;
  }
}

export async function refresh(): Promise<void> {
  if (treeState.root) await loadRoot(treeState.root);
}

export async function toggleExpand(node: FileNode): Promise<void> {
  if (!node.is_dir) return;
  const p = node.path;
  if (treeState.expanded.has(p)) {
    treeState.expanded.delete(p);
    return;
  }
  // 懒加载子节点
  if (!node.children || node.children.length === 0) {
    try {
      const fresh = await readDirTree(p, 1, treeState.showHidden);
      node.children = fresh.children ?? [];
    } catch {
      node.children = [];
    }
  }
  treeState.expanded.add(p);
}

export function setShowHidden(v: boolean) {
  treeState.showHidden = v;
  refresh().catch(() => undefined);
}
