<script setup lang="ts">
import { ref } from "vue";
import { getRecent, clearRecent } from "@/stores/recent";

const emit = defineEmits<{
  open: [];
  "open-folder": [];
  "open-path": [path: string];
}>();

const recent = ref(getRecent());

function clearAll() {
  clearRecent();
  recent.value = [];
}
</script>

<template>
  <div class="absolute inset-0 flex items-center justify-center overflow-auto">
    <div class="text-center select-none">
      <div class="text-[42px] font-bold tracking-wide mb-1">
        Note<span class="accent">Plus</span><span class="accent">+</span>
      </div>
      <p class="text-xs text-muted mb-8">macOS 上的轻量级代码编辑器</p>

      <div class="flex items-center justify-center gap-3 mb-10">
        <button class="np-btn primary" @click="emit('open')">打开文件</button>
        <button class="np-btn" @click="emit('open-folder')">打开文件夹</button>
      </div>

      <div class="shortcut-list text-left">
        <div class="row"><span class="k">⌘N</span><span>新建文件</span></div>
        <div class="row"><span class="k">⌘O</span><span>打开文件</span></div>
        <div class="row"><span class="k">⇧⌘O</span><span>打开文件夹</span></div>
        <div class="row"><span class="k">⌘S</span><span>保存</span></div>
        <div class="row"><span class="k">⌥⌘S</span><span>保存全部</span></div>
        <div class="row"><span class="k">⌘W</span><span>关闭标签页</span></div>
        <div class="row"><span class="k">⌘F</span><span>查找和替换窗口</span></div>
        <div class="row"><span class="k">⌘G / ⇧⌘G</span><span>下一个 / 上一个匹配</span></div>
        <div class="row"><span class="k">⌘B</span><span>显示 / 隐藏侧边栏</span></div>
        <div class="row"><span class="k">⌘/</span><span>注释当前行</span></div>
        <div class="row"><span class="k">⌘+ / ⌘- / ⌘0</span><span>放大 / 缩小 / 重置字号</span></div>
        <div class="row"><span class="k">⌘,</span><span>设置</span></div>
        <div class="row"><span class="k">拖拽</span><span>拖入文件即可打开</span></div>
      </div>

      <div v-if="recent.length" class="mt-10 text-left">
        <div class="flex items-center gap-2 mb-2">
          <span class="text-xs text-muted">最近打开</span>
          <span class="text-xs accent cursor-pointer" @click="clearAll">清空</span>
        </div>
        <div
          v-for="p in recent.slice(0, 8)"
          :key="p"
          class="recent-row text-muted"
          :title="p"
          @click="emit('open-path', p)"
        >
          {{ p.split("/").pop() }}
          <span class="path text-xs opacity-60">{{ p }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.shortcut-list {
  width: 320px;
  margin: 0 auto;
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 26px;
  font-size: 12px;
  color: var(--muted);
}
.k {
  font-family: "SF Mono", Menlo, monospace;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 1px 7px;
  font-size: 11px;
  color: var(--text);
}
.recent-row {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 26px;
  font-size: 12px;
  cursor: pointer;
  border-radius: 6px;
  padding: 0 8px;
  max-width: 420px;
  overflow: hidden;
  white-space: nowrap;
}
.recent-row:hover {
  background: var(--hover);
  color: var(--text);
}
.path {
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
