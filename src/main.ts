import { createApp } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App.vue";
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
  createApp(App).mount("#app");
}
