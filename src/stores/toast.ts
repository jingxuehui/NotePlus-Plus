import { reactive } from "vue";

export const toast = reactive({ msg: "", ts: 0, isError: true });

let timer: number | undefined;

export function notify(msg: string, isError = true) {
  toast.msg = msg;
  toast.isError = isError;
  toast.ts = Date.now();
  if (timer) window.clearTimeout(timer);
  timer = window.setTimeout(() => (toast.msg = ""), isError ? 5000 : 2500);
}
