<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from "vue";
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { activeTab, getState, setState, editorHooks } from "@/stores/tabs";
import { settings } from "@/stores/settings";
import { viewRef } from "@/editor/view";
import { reconfigureAppearance, updateLanguageForPath } from "@/editor/setup";

const container = ref<HTMLDivElement | null>(null);
let view: EditorView | null = null;

const emptyState = EditorState.create({ doc: "" });

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
  updateLanguageForPath(view, activeTab.value?.path ?? null);
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
  updateLanguageForPath(view, tab?.path ?? null);
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
  <div ref="container" class="absolute inset-0 overflow-hidden"></div>
</template>
