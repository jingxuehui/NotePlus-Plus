<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { SHORTCUTS, shortcutParts } from "@/data/shortcuts";
import { t } from "@/i18n";
import { isMac } from "@/utils/platform";

const open = ref(false);
const root = ref<HTMLDivElement | null>(null);

function onDocClick(e: MouseEvent) {
  if (open.value && root.value && !root.value.contains(e.target as Node)) open.value = false;
}
function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") open.value = false;
}

onMounted(() => {
  document.addEventListener("mousedown", onDocClick);
  document.addEventListener("keydown", onKey);
});
onBeforeUnmount(() => {
  document.removeEventListener("mousedown", onDocClick);
  document.removeEventListener("keydown", onKey);
});
</script>

<template>
  <div ref="root" class="hint-root">
    <span
      class="icon-btn"
      :class="{ active: open }"
      :title="t('sc.tipTitle')"
      @click="open = !open"
    >
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
        <rect x="1.4" y="4" width="13.2" height="8.6" rx="1.8" />
        <line x1="4" y1="6.6" x2="4" y2="6.7" stroke-width="1.8" stroke-linecap="round" />
        <line x1="6.6" y1="6.6" x2="6.6" y2="6.7" stroke-width="1.8" stroke-linecap="round" />
        <line x1="9.2" y1="6.6" x2="9.2" y2="6.7" stroke-width="1.8" stroke-linecap="round" />
        <line x1="11.8" y1="6.6" x2="11.8" y2="6.7" stroke-width="1.8" stroke-linecap="round" />
        <line x1="4.4" y1="9.9" x2="11.6" y2="9.9" stroke-linecap="round" />
      </svg>
    </span>

    <div v-if="open" class="hint-pop">
      <div class="hint-title">{{ t("sc.title") }}</div>
      <div v-for="s in SHORTCUTS" :key="s.k" class="hint-row">
        <span class="hint-key" :class="{ plain: !isMac || s.keyLabel }"
          ><template v-if="s.keyLabel">{{ t(s.keyLabel) }}</template
          ><template v-else-if="isMac"
            ><template v-for="(p, i) in shortcutParts(s.k)" :key="i"
              ><span v-if="p.sym" class="sym">{{ p.text }}</span
              ><template v-else>{{ p.text }}</template></template
            ></template
          ><template v-else>{{ s.kw ?? s.k }}</template></span
        >
        <span class="hint-label">{{ t(s.label) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hint-root {
  position: relative;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
.hint-pop {
  position: absolute;
  top: 32px;
  right: -4px;
  width: 282px;
  max-height: calc(100vh - 64px);
  overflow: auto;
  padding: 8px 10px 10px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45);
  z-index: 50;
}
.hint-title {
  font-size: 11px;
  color: var(--muted);
  letter-spacing: 0.04em;
  margin: 0 0 6px 2px;
}
.hint-row {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 22px;
}
.hint-key {
  flex-shrink: 0;
  width: 112px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 18px;
  box-sizing: border-box;
  padding: 0 4px;
  font-family: "SF Mono", Menlo, monospace;
  font-size: 10px;
  letter-spacing: 0.5px;
  color: var(--text);
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 4px;
  white-space: nowrap;
}
.hint-key .sym {
  font-size: 12px;
  line-height: 1;
}
/* Windows 组合键为普通文本，不需要逐字符放大间距 */
.hint-key.plain {
  letter-spacing: 0.3px;
}
.hint-label {
  flex: 1;
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
