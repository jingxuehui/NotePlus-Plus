<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { toggleUpdateCenter } from "@/stores/ui";
import { openExternal } from "@/commands";
import { notify } from "@/stores/toast";

const appVersion = __APP_VERSION__;

const activeTab = ref<"notes" | "history">("notes");
const source = ref<"github" | "gitee">("github");
const checking = ref(false);

function close() {
  toggleUpdateCenter(false);
}

function checkUpdate() {
  if (checking.value) return;
  checking.value = true;
  window.setTimeout(() => {
    checking.value = false;
    notify("当前已是最新版本", false);
  }, 600);
}

function openDownloadPage() {
  const url = source.value === "github"
    ? "https://github.com/jingxuehui/NotePlus-Plus/releases"
    : "https://gitee.com/jingxuehui/NotePlus-Plus/releases";
  openExternal(url).catch((e) => console.error("打开下载页失败", e));
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.stopPropagation();
    close();
  }
}

onMounted(() => window.addEventListener("keydown", onKeydown, true));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown, true));
</script>

<template>
  <Teleport to="body">
    <div class="uc-overlay" @click.self="close">
      <div class="uc-window">
        <header class="uc-header">
          <span class="uc-head-icon">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" />
            </svg>
          </span>
          <span class="uc-title">更新中心</span>
          <span class="uc-badge">当前 v{{ appVersion }}</span>
          <span class="uc-spacer"></span>
          <button class="uc-btn primary sm" :disabled="checking" @click="checkUpdate">
            {{ checking ? "检查中…" : "检查更新" }}
          </button>
          <span class="uc-close" title="关闭" @click="close">
            <svg width="12" height="12" viewBox="0 0 10 10" stroke="currentColor" stroke-width="1.4">
              <line x1="1" y1="1" x2="9" y2="9" /><line x1="9" y1="1" x2="1" y2="9" />
            </svg>
          </span>
        </header>

        <nav class="uc-tabs">
          <button :class="{ on: activeTab === 'notes' }" @click="activeTab = 'notes'">更新日志</button>
          <button :class="{ on: activeTab === 'history' }" @click="activeTab = 'history'">历史版本</button>
        </nav>

        <div class="uc-body">
          <div class="uc-version-line">当前版本 NotePlus+ {{ appVersion }}</div>
          <div class="uc-empty">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" /><path d="M8 13h8M8 17h6" />
            </svg>
            <template v-if="activeTab === 'notes'">
              <div class="uc-empty-title">暂无发布说明</div>
              <div class="uc-empty-desc">各版本的更新内容请前往下方更新源 releases 页面查看。</div>
            </template>
            <template v-else>
              <div class="uc-empty-title">暂无历史版本记录</div>
              <div class="uc-empty-desc">历史版本与变更内容请前往下方更新源 releases 页面查看。</div>
            </template>
          </div>
        </div>

        <footer class="uc-footer">
          <span class="uc-label">更新源</span>
          <div class="uc-select-wrap">
            <select v-model="source">
              <option value="gitee">Gitee</option>
              <option value="github">GitHub</option>
            </select>
          </div>
          <span class="uc-spacer"></span>
          <button class="uc-btn" @click="openDownloadPage">打开下载页</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.uc-overlay {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(3px);
}
.uc-window {
  width: min(860px, 92vw);
  height: min(620px, 88vh);
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: calc(var(--ui-radius, 6px) + 4px);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.6);
  overflow: hidden;
  animation: uc-pop 0.16s ease-out;
  font-size: 14px;
}
@keyframes uc-pop {
  from { opacity: 0; transform: translateY(-8px) scale(0.985); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.uc-header {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 52px;
  padding: 0 16px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.uc-head-icon { display: inline-flex; color: var(--accent); }
.uc-title { font-size: 16px; font-weight: 600; color: var(--text); }
.uc-badge {
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--accent-tint);
  border: 1px solid var(--accent-edge);
  color: var(--accent);
  font-size: 11px;
}
.uc-spacer { flex: 1; }
.uc-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--ui-radius, 6px);
  color: var(--muted);
  cursor: pointer;
}
.uc-close:hover { background: var(--hover); color: var(--text); }

.uc-tabs {
  display: flex;
  align-items: center;
  gap: 22px;
  height: 40px;
  padding: 0 20px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.uc-tabs button {
  position: relative;
  height: 40px;
  padding: 0 2px;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 13px;
  cursor: pointer;
}
.uc-tabs button.on { color: var(--text); font-weight: 600; }
.uc-tabs button.on::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2px;
  border-radius: 2px;
  background: var(--accent);
}

.uc-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 20px;
}
.uc-version-line {
  color: var(--text);
  font-size: 13px;
  margin-bottom: 14px;
}
.uc-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 100%;
  min-height: 260px;
  color: var(--muted);
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: var(--ui-radius, 6px);
  text-align: center;
}
.uc-empty-title { color: var(--text); font-size: 14px; font-weight: 600; }
.uc-empty-desc { font-size: 12px; opacity: 0.85; }

.uc-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 56px;
  padding: 0 16px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}
.uc-label { color: var(--muted); font-size: 12px; }
.uc-select-wrap select {
  height: 28px;
  padding: 0 8px;
  color: var(--text);
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: var(--ui-radius, 6px);
  outline: none;
  font-size: 12px;
}
.uc-btn {
  height: 30px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: var(--ui-radius, 6px);
  background: var(--panel-2);
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
}
.uc-btn:hover:not(:disabled) { background: var(--hover); }
.uc-btn:disabled { opacity: 0.55; cursor: default; }
.uc-btn.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--panel);
}
.uc-btn.sm { height: 28px; padding: 0 12px; }
</style>
