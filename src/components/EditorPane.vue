<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from "vue";
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { activeTab, getState, setState, editorHooks, applyTabLanguage } from "@/stores/tabs";
import { settings } from "@/stores/settings";
import { viewRef } from "@/editor/view";
import { reconfigureAppearance } from "@/editor/setup";
import EditorContextMenu from "./EditorContextMenu.vue";
import EditorSearchPanel from "./EditorSearchPanel.vue";

const container = ref<HTMLDivElement | null>(null);
let view: EditorView | null = null;

const emptyState = EditorState.create({ doc: "" });

// 编辑器右键：用自定义多语言菜单替代原生菜单
const ctxMenuPos = ref<{ x: number; y: number } | null>(null);

/**
 * WKWebView 右键会把光标处单词自动选中（原生行为，preventDefault 拦不住），还可能把
 * 行末光标弄丢。处理：
 * 1. mousedown 捕获阶段临时给编辑器内容设置 user-select:none，从源头阻止原生选词；
 * 2. 快照当前选区；结束时恢复 user-select 并把选区/焦点强制恢复到按下前状态：
 *    - 点击在已有选区内：保留选区；
 *    - 点击在选区外/无选区：光标定位到点击处，不做任何词选择。
 * 3. WebKit 原生选词/焦点变更可能异步提交、晚于我们的恢复，因此立即 + 延迟一拍 +
 *    下一帧共恢复三次，以最后一次为准。
 */
interface RightClickSnapshot {
  from: number;
  to: number;
  /** 点击目标位置；为 null 表示点击在选区内（保留原选区） */
  anchor: number | null;
}
let rightClickSnapshot: RightClickSnapshot | null = null;

function onMouseDown(e: MouseEvent) {
  if (e.button !== 2) return;
  e.preventDefault();
  const v = viewRef.current;
  if (!v) return;
  v.contentDOM.style.userSelect = "none";
  const sel = v.state.selection.main;
  const pos = v.posAtCoords({ x: e.clientX, y: e.clientY });
  rightClickSnapshot = {
    from: sel.from,
    to: sel.to,
    anchor: pos != null && (pos < sel.from || pos > sel.to) ? pos : null,
  };
}

/** 把选区与焦点强制恢复到快照状态（无条件执行，保证光标可见） */
function reassertSelection(snap: RightClickSnapshot) {
  const v = viewRef.current;
  if (!v) return;
  v.dispatch({
    selection:
      snap.anchor != null
        ? { anchor: snap.anchor }
        : { anchor: snap.from, head: snap.to },
  });
  if (!v.hasFocus) v.focus();
}

function finishRightClick() {
  const snap = rightClickSnapshot;
  rightClickSnapshot = null;
  const contentEl = viewRef.current?.contentDOM;
  if (contentEl) contentEl.style.userSelect = "";
  if (!snap) return;
  reassertSelection(snap);
  setTimeout(() => reassertSelection(snap), 0);
  requestAnimationFrame(() => reassertSelection(snap));
}

function onContextMenu(e: MouseEvent) {
  finishRightClick();
  ctxMenuPos.value = { x: e.clientX, y: e.clientY };
}

/** 兜底：contextmenu 因任何原因未触发时，松开右键后也要恢复 */
function onMouseUp(e: MouseEvent) {
  if (e.button !== 2) return;
  setTimeout(() => {
    if (rightClickSnapshot) finishRightClick();
  }, 0);
}

/** 关闭右键菜单时把焦点还给编辑器，避免点遮罩/Esc 关闭后光标消失 */
function closeCtxMenu() {
  ctxMenuPos.value = null;
  viewRef.current?.focus();
}

onMounted(() => {
  const tab = activeTab.value;
  view = new EditorView({
    parent: container.value!,
    state: (tab && getState(tab)) ?? emptyState,
    dispatch: (tr) => {
      view!.update([tr]);
      // 把最新 state 写回非响应式 Map
      const current = activeTab.value;
      if (current) setState(current, view!.state);
    },
  });
  viewRef.current = view;
  applyTabLanguage(view, activeTab.value);
  view.focus();
});

onBeforeUnmount(() => {
  view?.destroy();
  viewRef.current = null;
});

// 切换标签时替换编辑器状态，并聚焦编辑器
watch(activeTab, (tab) => {
  if (!view) return;
  view.setState(tab ? (getState(tab) ?? emptyState) : emptyState);
  applyTabLanguage(view, tab);
  view.focus();
});

// 主题 / 字号 / 换行设置变化时重新配置外观
watch(
  () => [settings.theme, settings.fontSize, settings.wordWrap] as const,
  () => {
    if (view) reconfigureAppearance(view, editorHooks);
  }
);
</script>

<template>
  <div ref="container" class="absolute inset-0 overflow-hidden" @contextmenu.prevent="onContextMenu" @mousedown.capture="onMouseDown" @mouseup.capture="onMouseUp"></div>
  <EditorSearchPanel />
  <EditorContextMenu
    v-if="ctxMenuPos"
    :x="ctxMenuPos.x"
    :y="ctxMenuPos.y"
    @close="closeCtxMenu"
  />
</template>
