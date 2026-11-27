import { createApp } from "vue";
import "./style.css";

// 查找已改为编辑器内嵌面板，不再使用独立 WebView 窗口。
import("./App.vue").then(({ default: App }) => createApp(App).mount("#app"));
