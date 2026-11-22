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
});

/** 打开 / 关闭设置弹框 */
export function toggleSettings(force?: boolean) {
  ui.showSettings = force ?? !ui.showSettings;
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
