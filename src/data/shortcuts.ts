export interface Shortcut {
  k: string;
  label: string;
}

/** 全局快捷键说明：欢迎页与标题栏的快捷键提示共用同一份数据 */
export const SHORTCUTS: Shortcut[] = [
  { k: "⌘N", label: "新建文件" },
  { k: "⌘O", label: "打开文件" },
  { k: "⇧⌘O", label: "打开文件夹" },
  { k: "⌘S", label: "保存" },
  { k: "⌥⌘S", label: "保存全部" },
  { k: "⌘W", label: "关闭标签页" },
  { k: "⌘F", label: "查找和替换窗口" },
  { k: "⌘G / ⇧⌘G", label: "下一个 / 上一个匹配" },
  { k: "⌘B", label: "显示 / 隐藏侧边栏" },
  { k: "⌘/", label: "注释当前行" },
  { k: "⇧⌥F", label: "格式化 JSON" },
  { k: "⌘+ / ⌘- / ⌘0", label: "放大 / 缩小 / 重置字号" },
  { k: "⌘,", label: "设置" },
  { k: "拖拽", label: "拖入文件即可打开" },
];
