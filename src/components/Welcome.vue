<script setup lang="ts">
import { ref } from "vue";
import { getRecent, clearRecent } from "@/stores/recent";
import { SHORTCUTS, shortcutParts } from "@/data/shortcuts";
import { t } from "@/i18n";
import { baseName } from "@/utils/path";
import { isMac } from "@/utils/platform";

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

// 快捷键列表与标题栏的快捷键提示共用同一份数据
const shortcuts = SHORTCUTS;


</script>

<template>
  <div class="absolute inset-0 flex items-center justify-center overflow-auto">
    <div class="text-center select-none">
      <div class="text-[42px] font-bold tracking-wide mb-1">
        Note<span class="accent">Plus</span><span class="accent">+</span>
      </div>
      <p class="text-xs text-muted mb-8">{{ t("welcome.tagline") }}</p>

      <div class="flex items-center justify-center gap-3 mb-10">
        <button class="np-btn primary" @click="emit('open')">{{ t("welcome.openFile") }}</button>
        <button class="np-btn" @click="emit('open-folder')">{{ t("welcome.openFolder") }}</button>
      </div>

      <div class="shortcut-list text-left">
        <div v-for="s in shortcuts" :key="s.k" class="row">
          <span class="k" :class="{ plain: !isMac || s.keyLabel }"
            ><template v-if="s.keyLabel">{{ t(s.keyLabel) }}</template
            ><template v-else-if="isMac"
              ><template v-for="(p, i) in shortcutParts(s.k)" :key="i"
                ><span v-if="p.sym" class="sym" :class="{ shift: p.text === '⇧' }">{{ p.text }}</span
                ><template v-else>{{ p.text }}</template></template
              ></template
            ><template v-else>{{ s.kw ?? s.k }}</template></span
          >
          <span>{{ t(s.label) }}</span>
        </div>
      </div>

      <div v-if="recent.length" class="mt-10 text-left">
        <div class="flex items-center gap-2 mb-2">
          <span class="text-xs text-muted">{{ t("welcome.recent") }}</span>
          <span class="text-xs accent cursor-pointer" @click="clearAll">{{ t("welcome.clear") }}</span>
        </div>
        <div
          v-for="p in recent.slice(0, 8)"
          :key="p"
          class="recent-row text-muted"
          :title="p"
          @click="emit('open-path', p)"
        >
          {{ baseName(p) }}
          <span class="path text-xs opacity-60">{{ p }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 宽度由键帽列 + 说明列决定，inline-flex 配合父级 text-align:center 真正水平居中 */
.shortcut-list {
  display: inline-flex;
  flex-direction: column;
  align-items: stretch;
  margin: 0 auto;
}
.row {
  display: flex;
  align-items: center;
  gap: 14px;
  height: 26px;
  font-size: 12px;
  color: var(--muted);
}
/* 说明列按文字实际宽度，最宽的一行决定列表宽度，整体才能对称居中 */
.row > span:last-child {
  flex: none;
  text-align: left;
  white-space: nowrap;
}
/* 键帽统一尺寸，长短组合键也不再忽宽忽窄 */
.k {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 126px;
  height: 20px;
  flex-shrink: 0;
  box-sizing: border-box;
  font-family: "SF Mono", Menlo, monospace;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 0 6px;
  font-size: 11px;
  color: var(--text);
  white-space: nowrap;
  text-align: center;
  /* 键帽内字符（⌘ 与 N 等）之间留 3px 间距 */
  letter-spacing: 3px;
}
/* Windows 组合键为普通文本（Ctrl+= / Ctrl+- / Ctrl+0 较长），取消逐字符间距并加宽 */
.k.plain {
  width: 176px;
  letter-spacing: 0.3px;
}
/* 修饰符符号（⌘⇧⌥⌃）在等宽字体里字形偏小，放大后与字母视觉等大 */
.k .sym {
  font-size: 14px;
  line-height: 1;
}
/* ⇧ 字形基线偏低，单独上移与其他字符对齐 */
.k .sym.shift {
  display: inline-block;
  transform: translateY(-1.5px);
}
/* Windows：Ctrl+Shift+O 等组合更长，缩紧字距并加宽键帽 */
.k.plain {
  width: 176px;
  letter-spacing: 0.4px;
  font-size: 10px;
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
