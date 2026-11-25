<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { EditorSelection } from "@codemirror/state";
import { undo as cmUndo, redo as cmRedo } from "@codemirror/commands";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { t } from "@/i18n";
import { viewRef } from "@/editor/view";
import { openFindWindow } from "@/find/bridge";

/**
 * 编辑器右键菜单：替代 WKWebView 原生菜单（原生菜单语言跟随系统且不可控）。
 * 词条经 i18n 跟随设置中的语言实时切换；剪切/复制/粘贴走系统剪贴板插件。
 */
const props = defineProps<{ x: number; y: number }>();
const emit = defineEmits<{ close: [] }>();

const MENU_W = 200;
const MENU_H = 208;
// 靠近窗口右下角时向内收，避免菜单被裁掉
const left = computed(() => Math.min(props.x, window.innerWidth - MENU_W - 8));
const top = computed(() => Math.min(props.y, window.innerHeight - MENU_H - 8));

interface Item {
  key: string;
  action: "undo" | "redo" | "cut" | "copy" | "paste" | "select-all" | "find";
  shortcut?: string;
}

const GROUPS: Item[][] = [
  [
    { key: "ctx.undo", action: "undo", shortcut: "⌘+Z" },
    { key: "ctx.redo", action: "redo", shortcut: "⇧+⌘+Z" },
  ],
  [
    { key: "ctx.cut", action: "cut", shortcut: "⌘+X" },
    { key: "ctx.copy", action: "copy", shortcut: "⌘+C" },
    { key: "ctx.paste", action: "paste", shortcut: "⌘+V" },
    { key: "ctx.selectAll", action: "select-all", shortcut: "⌘+A" },
  ],
  [{ key: "ctx.findReplace", action: "find", shortcut: "⌘+F" }],
];

async function run(action: Item["action"]) {
  emit("close");
  const view = viewRef.current;
  if (!view) return;
  const sel = view.state.selection.main;
  switch (action) {
    case "undo":
      cmUndo(view);
      break;
    case "redo":
      cmRedo(view);
      break;
    case "cut":
      if (!sel.empty) {
        await writeText(view.state.sliceDoc(sel.from, sel.to));
        view.dispatch({ changes: { from: sel.from, to: sel.to, insert: "" } });
      }
      break;
    case "copy":
      if (!sel.empty) await writeText(view.state.sliceDoc(sel.from, sel.to));
      break;
    case "paste": {
      const text = await readText();
      view.dispatch({
        changes: { from: sel.from, to: sel.to, insert: text },
      });
      break;
    }
    case "select-all":
      view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } });
      break;
    case "find":
      openFindWindow();
      return; // 查找窗口会自行聚焦，不抢占编辑器焦点
  }
  view.focus();
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") emit("close");
}
onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <Teleport to="body">
    <div class="ctx-menu-mask" @click="emit('close')" @contextmenu.prevent="emit('close')"></div>
    <div class="ctx-menu" :style="{ left: left + 'px', top: top + 'px' }">
      <template v-for="(group, gi) in GROUPS">
        <div v-if="gi > 0" :key="`sep-${gi}`" class="ctx-menu-sep"></div>
        <button
          v-for="item in group"
          :key="item.key"
          class="ctx-menu-item"
          @click="run(item.action)"
        >
          <span>{{ t(item.key) }}</span>
          <span class="ctx-menu-shortcut">{{ item.shortcut }}</span>
        </button>
      </template>
    </div>
  </Teleport>
</template>

<style scoped>
.ctx-menu-mask {
  position: fixed;
  inset: 0;
  z-index: 900;
}
.ctx-menu {
  position: fixed;
  z-index: 901;
  display: flex;
  flex-direction: column;
  min-width: 200px;
  padding: 4px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
}
.ctx-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  background: transparent;
  border: none;
  border-radius: 5px;
  color: var(--text);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.ctx-menu-item:hover {
  background: var(--hover);
}
.ctx-menu-shortcut {
  margin-left: auto;
  color: var(--muted);
  font-size: 11px;
}
.ctx-menu-sep {
  height: 1px;
  margin: 4px 6px;
  background: var(--border);
}
</style>
