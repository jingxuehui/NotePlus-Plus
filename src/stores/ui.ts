import { reactive } from "vue";

interface ModalRequest {
  title: string;
  message: string;
  choices: string[];
  danger?: boolean;
}

export const ui = reactive({
  modal: null as ModalRequest | null,
  showSettings: false,
  showUpdateCenter: false,
  showTools: false,
});

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
