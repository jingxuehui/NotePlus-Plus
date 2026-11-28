import { reactive } from "vue";

interface ModalRequest {
  title: string;
  message: string;
  choices: string[];
  danger?: boolean;
}

export type MdPreviewMode = "edit" | "preview" | "split";

export const ui = reactive({
  modal: null as ModalRequest | null,
  showSettings: false,
  showUpdateCenter: false,
  showTools: false,
  showPalette: false,
  /** Markdown 预览模式：编辑 / 全屏预览 / 左右分屏（仅 Markdown 标签生效） */
  mdPreview: "edit" as MdPreviewMode,
});

/** 循环切换 Markdown 预览模式：编辑 → 预览 → 分屏 → 编辑 */
export function cycleMdPreview() {
  ui.mdPreview = ui.mdPreview === "edit" ? "preview" : ui.mdPreview === "preview" ? "split" : "edit";
}

/** 打开 / 关闭命令面板 */
export function togglePalette(force?: boolean) {
  ui.showPalette = force ?? !ui.showPalette;
}

/** 打开 / 关闭设置弹框 */
export function toggleSettings(force?: boolean) {
  ui.showSettings = force ?? !ui.showSettings;
}

/** 打开 / 关闭更新中心 */
export function toggleUpdateCenter(force?: boolean) {
  ui.showUpdateCenter = force ?? !ui.showUpdateCenter;
}

/** 打开 / 关闭工具面板 */
export function toggleTools(force?: boolean) {
  ui.showTools = force ?? !ui.showTools;
}

let modalResolve: ((choice: string) => void) | null = null;

/** 三态确认弹窗：返回用户选择的选项文本 */
export function confirmChoice(
  title: string,
  message: string,
  choices: string[],
  danger = false
): Promise<string> {
  return new Promise((resolve) => {
    modalResolve = resolve;
    ui.modal = { title, message, choices, danger };
  });
}

export function resolveModal(choice: string) {
  ui.modal = null;
  if (modalResolve) {
    modalResolve(choice);
    modalResolve = null;
  }
}
