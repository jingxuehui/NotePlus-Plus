/// <reference types="vite/client" />

/** 由 vite.config.ts 的 define 注入（package.json 版本，运行时会被 Tauri 打包元数据覆盖） */
declare const __APP_VERSION__: string;

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
