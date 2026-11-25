import { createApp } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import FindDialog from "./components/FindDialog.vue";
import "./style.css";

function currentLabel(): string {
  try {
    return getCurrentWindow().label;
  } catch {
    return "main";
  }
}

const label = currentLabel();

if (label === "find") {
  document.body.classList.add("find-window");
  createApp(FindDialog).mount("#app");
} else {
  // 查找窗口无需求值整个编辑器依赖图，主界面按需引入
  import("./App.vue").then(({ default: App }) => createApp(App).mount("#app"));
}
