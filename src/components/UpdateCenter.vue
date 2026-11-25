<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { toggleUpdateCenter } from "@/stores/ui";
import { settings } from "@/stores/settings";
import { openExternal, type ReleaseInfo } from "@/commands";
import { updater } from "@/stores/updater";
import { notify } from "@/stores/toast";
import { t } from "@/i18n";

const {
  appVersion,
  source,
  checking,
  loading,
  loadError,
  releases,
  downloadState,
  downloading,
  downloadError,
  latest,
  olderReleases,
  hasUpdate,
  checkForUpdates,
  ensureDownloaded,
} = updater;

type TabId = "app" | "changelog";
const activeTab = ref<TabId>("app");
const tabs = computed(() => [
  { id: "app" as const, label: "NotePlus+", count: hasUpdate.value ? 1 : 0 },
  { id: "changelog" as const, label: t("uc.changelog"), count: 0 },
]);
const totalUpdateCount = computed(() => tabs.value.reduce((n, t) => n + t.count, 0));

const historyOpen = ref(false);
const historyVisibleCount = ref(5);
const visibleOlderReleases = computed(() => olderReleases.value.slice(0, historyVisibleCount.value));
const hasMoreHistory = computed(() => historyVisibleCount.value < olderReleases.value.length);

const visibleCount = ref(5);
const expandedTags = ref<Set<string>>(new Set());
const visibleReleases = computed(() => releases.value.slice(0, visibleCount.value));
const hasMoreReleases = computed(() => visibleCount.value < releases.value.length);

interface TextBlock {
  type: "heading" | "item" | "text";
  text: string;
}
function parseBody(body: string): TextBlock[] {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const blocks: TextBlock[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || /^---+$/.test(line)) continue;
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (heading) {
      blocks.push({ type: "heading", text: heading[1] });
      continue;
    }
    const item = line.match(/^(?:[-*+]\s+|\d+[、．]\s*|\d+\.\s+)(.*)$/);
    if (item) {
      blocks.push({ type: "item", text: stripMarkdown(item[1]) });
      continue;
    }
    blocks.push({ type: "text", text: stripMarkdown(line) });
  }
  return blocks;
}
function stripMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`]/g, "")
    .trim();
}
function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toggleRelease(tag: string) {
  const next = new Set(expandedTags.value);
  if (next.has(tag)) next.delete(tag);
  else next.add(tag);
  expandedTags.value = next;
}

function checkUpdate() {
  void updater.refreshManually().then(() => {
    notify(releases.value.length ? t("uc.fetchedToast", { n: releases.value.length }) : t("uc.checkDone"), false);
  });
}

function retry() {
  void checkForUpdates();
}

function close() {
  toggleUpdateCenter(false);
}

function openDownloadPage() {
  const url = source.value === "github"
    ? "https://github.com/jingxuehui/NotePlus-Plus/releases"
    : "https://gitee.com/jingxuehui/NotePlus-Plus/releases";
  openExternal(url).catch((e) => console.error("打开下载页失败", e));
}

function openRelease(r: ReleaseInfo) {
  if (r.htmlUrl) openExternal(r.htmlUrl).catch((e) => console.error("打开发布页失败", e));
}

function ignoreVersion() {
  const r = latest.value;
  if (!r) return;
  updater.ignore();
  notify(t("uc.ignoredToast", { tag: r.tag }), false);
}

function restoreIgnored() {
  settings.ignoredVersion = "";
  notify(t("uc.restoredToast"), false);
}

async function restartUpdate() {
  try {
    await updater.install();
  } catch (e) {
    notify(e instanceof Error ? e.message : String(e));
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.stopPropagation();
    close();
  }
}

watch(source, () => { void checkForUpdates(); });
onMounted(() => {
  window.addEventListener("keydown", onKeydown, true);
  // 页面先完成首屏渲染，下一次事件循环再拉取发布信息
  setTimeout(() => {
    if (!releases.value.length && !loading.value) void checkForUpdates();
  }, 0);
});
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown, true));
</script>

<template>
  <Teleport to="body">
    <div class="uc-overlay" @click.self="close">
      <div class="uc-window">
        <header class="uc-header">
          <span class="uc-title">{{ t("uc.title") }}</span>
          <span v-if="totalUpdateCount > 0" class="uc-count-badge">{{ t("uc.badge", { n: totalUpdateCount }) }}</span>
          <span class="uc-spacer"></span>
          <span class="uc-close" :title="t('common.close')" @click="close">
            <svg width="12" height="12" viewBox="0 0 10 10" stroke="currentColor" stroke-width="1.4">
              <line x1="1" y1="1" x2="9" y2="9" /><line x1="9" y1="1" x2="1" y2="9" />
            </svg>
          </span>
        </header>

        <div class="uc-content">
          <div class="uc-tabs">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              class="uc-tab"
              :class="{ on: activeTab === tab.id }"
              @click="activeTab = tab.id"
            >
              <span>{{ tab.label }}</span>
              <span v-if="tab.count > 0" class="uc-tab-count">{{ tab.count }}</span>
            </button>
          </div>

          <div class="uc-scroll">
            <div v-if="activeTab === 'app'" class="uc-panel">
              <p v-if="loadError" class="uc-error-line">
                {{ t("uc.fetchFailed", { err: loadError }) }}
                <button class="uc-link" @click="retry">{{ t("uc.retry") }}</button>
              </p>
              <template v-else-if="!releases.length">
                <p v-if="loading" class="uc-inline"><span class="uc-spinner sm"></span> {{ t("uc.checking") }}</p>
                <p v-else class="uc-muted">{{ t("uc.noReleases") }}</p>
              </template>
              <template v-else>
                <p v-if="hasUpdate" class="uc-message">
                  {{ t("uc.updateMsg", { tag: latest?.tag ?? "", ver: appVersion }) }}
                  <span v-if="latest?.prerelease" class="uc-pre">{{ t("uc.pre") }}</span>
                </p>
                <p v-else class="uc-message muted">
                  <template v-if="settings.ignoredVersion">
                    {{ t("uc.ignored", { ver: settings.ignoredVersion }) }}
                    <button class="uc-link" @click="restoreIgnored">{{ t("uc.unignore") }}</button>
                  </template>
                  <template v-else>{{ t("uc.upToDate", { ver: appVersion }) }}</template>
                </p>

                <div v-if="parseBody(latest?.body ?? '').length" class="uc-notes">
                  <template v-for="(b, i) in parseBody(latest?.body ?? '')" :key="i">
                    <div v-if="b.type === 'heading'" class="uc-md-heading">{{ b.text }}</div>
                    <div v-else-if="b.type === 'item'" class="uc-md-item">{{ b.text }}</div>
                    <div v-else class="uc-md-text">{{ b.text }}</div>
                  </template>
                </div>
                <div v-else class="uc-notes muted">{{ t("uc.seeRelease") }}</div>

                <p v-if="checking || loading" class="uc-inline"><span class="uc-spinner sm"></span> {{ t("uc.checking") }}</p>
                <p v-if="downloadState === 'done'" class="uc-inline done">
                  {{ t("uc.downloaded", { tag: latest?.tag ?? "" }) }}
                </p>
                <p v-if="downloadState === 'error'" class="uc-inline error">
                  {{ t("uc.downloadFailed", { err: downloadError ?? "" }) }}
                  <button class="uc-link" @click="ensureDownloaded">{{ t("uc.retryDownload") }}</button>
                </p>

                <div v-if="olderReleases.length" class="uc-history">
                  <button class="uc-history-toggle" @click="historyOpen = !historyOpen">
                    <span>{{ t("uc.history") }}</span>
                    <svg class="uc-chevron" :class="{ open: historyOpen }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                  <div v-show="historyOpen" class="uc-history-body">
                    <p class="uc-hint">{{ t("uc.historyHint") }}</p>
                    <div class="uc-history-list">
                      <div v-for="r in visibleOlderReleases" :key="r.tag" class="uc-history-row">
                        <span class="uc-tag">{{ r.tag }}</span>
                        <span class="uc-muted tiny">{{ t("uc.publishedAt", { date: formatDate(r.publishedAt) }) }}</span>
                        <button class="uc-btn sm" @click="openRelease(r)">{{ t("uc.openDownload") }}</button>
                      </div>
                    </div>
                    <button v-if="hasMoreHistory" class="uc-btn ghost wide" @click="historyVisibleCount += 5">{{ t("uc.loadMore") }}</button>
                  </div>
                </div>
              </template>
            </div>

            <div v-else class="uc-panel changelog-panel">
              <div class="uc-panel-head">
                <div>
                  <div class="uc-panel-title">{{ t("uc.changelog") }}</div>
                  <p class="uc-muted small">{{ t("uc.changelogDesc") }}</p>
                </div>
                <div class="uc-head-actions">
                  <button class="uc-btn sm" :disabled="checking || loading" @click="checkUpdate">{{ t("titlebar.checkUpdate") }}</button>
                  <button class="uc-btn sm" @click="openDownloadPage">{{ t("uc.viewOnline") }}</button>
                </div>
              </div>

              <p v-if="loading && !releases.length" class="uc-inline"><span class="uc-spinner sm"></span> {{ t("uc.loadingLog") }}</p>
              <div v-else class="uc-release-list">
                <div v-for="r in visibleReleases" :key="r.tag" class="uc-release-item">
                  <button class="uc-release-toggle" @click="toggleRelease(r.tag)">
                    <span class="uc-tag-badge">{{ r.tag.replace(/^v/, '') }}</span>
                    <span v-if="r.tag === latest?.tag" class="uc-new">NEW</span>
                    <span class="uc-muted tiny">{{ t("uc.publishedAt", { date: formatDate(r.publishedAt) }) }}</span>
                    <svg class="uc-chevron" :class="{ open: expandedTags.has(r.tag) }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                  <div v-if="expandedTags.has(r.tag)" class="uc-release-detail">
                    <template v-if="parseBody(r.body).length">
                      <template v-for="(b, i) in parseBody(r.body)" :key="i">
                        <div v-if="b.type === 'heading'" class="uc-section-title">{{ b.text }}</div>
                        <div v-else-if="b.type === 'item'" class="uc-bullet">{{ b.text }}</div>
                        <div v-else class="uc-md-text">{{ b.text }}</div>
                      </template>
                    </template>
                    <p v-else class="uc-muted small">{{ t("uc.seeRelease") }}</p>
                    <button class="uc-btn sm ghost" @click="openRelease(r)">GitHub Release</button>
                  </div>
                </div>
                <button v-if="hasMoreReleases" class="uc-btn wide" @click="visibleCount += 5">{{ t("uc.loadMore") }}</button>
              </div>
            </div>
          </div>
        </div>

        <footer v-if="activeTab === 'app'" class="uc-footer">
          <div v-if="hasUpdate && downloadState !== 'done' && !downloading" class="uc-source">
            <span class="uc-muted small">{{ t("uc.source") }}</span>
            <div class="uc-select-wrap">
              <select v-model="source">
                <option value="gitee">Gitee</option>
                <option value="github">GitHub</option>
              </select>
            </div>
          </div>
          <span class="uc-spacer"></span>
          <template v-if="hasUpdate">
            <button class="uc-btn ghost" @click="ignoreVersion">{{ t("uc.ignoreVersion") }}</button>
            <button class="uc-btn" @click="openDownloadPage">{{ t("uc.openDownload") }}</button>
            <div v-if="downloading" class="uc-progress">
              <span>{{ t("uc.downloading") }}</span>
              <div class="uc-progress-track"><div class="uc-progress-fill"></div></div>
            </div>
            <button v-else-if="downloadState === 'done'" class="uc-btn primary" :title="t('uc.restartTip')" @click="restartUpdate">{{ t("uc.restartUpdate") }}</button>
            <button v-else class="uc-btn primary" @click="ensureDownloaded">{{ t("uc.backgroundDownload") }}</button>
          </template>
          <button v-else class="uc-btn" @click="openDownloadPage">{{ t("uc.openDownload") }}</button>
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
  align-items: flex-start;
  justify-content: center;
  padding-top: max(24px, calc((100vh - 720px) / 2));
  background: rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(3px);
}
.uc-window {
  width: min(700px, 92vw);
  max-height: min(720px, 88vh);
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: calc(var(--ui-radius, 6px) + 4px);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.6);
  overflow: hidden;
  animation: uc-pop 0.16s ease-out;
  font-size: 13px;
}
@keyframes uc-pop {
  from { opacity: 0; transform: translateY(-8px) scale(0.985); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.uc-header {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 56px;
  padding: 12px 20px 12px 22px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.uc-title { font-size: 15px; font-weight: 600; color: var(--text); }
.uc-count-badge {
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--accent-tint);
  color: var(--accent);
  font-size: 11px;
  font-weight: 500;
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

.uc-content { display: flex; flex: 1; min-height: 0; flex-direction: column; }
.uc-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 42px;
  padding: 6px 20px 0;
  overflow-x: auto;
  flex-shrink: 0;
}
.uc-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 10px;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
}
.uc-tab.on { color: var(--text); }
.uc-tab.on::after {
  content: "";
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: 0;
  height: 2px;
  border-radius: 2px;
  background: var(--text);
}
.uc-tab:hover { color: var(--text); }
.uc-tab-count {
  padding: 0 6px;
  border-radius: 8px;
  background: var(--hover);
  font-size: 11px;
}
.uc-scroll { flex: 1; min-height: 0; overflow: auto; padding: 16px 20px; }
.uc-panel { display: flex; flex-direction: column; gap: 12px; }
.changelog-panel {
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: calc(var(--ui-radius, 6px) + 2px);
}

.uc-message { margin: 0; color: var(--text); line-height: 1.6; }
.uc-message.muted, .uc-muted { color: var(--muted); }
.uc-message strong { color: var(--accent); }
.uc-pre {
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: 8px;
  background: var(--accent-tint);
  color: var(--accent);
  font-size: 11px;
}
.uc-small { font-size: 12px; }
.uc-tiny { font-size: 11px; }
.uc-link {
  border: none;
  background: transparent;
  color: var(--accent);
  font-size: 12px;
  cursor: pointer;
}
.uc-link:hover { text-decoration: underline; }
.uc-error-line { margin: 0; color: var(--text); }

.uc-notes {
  max-height: 256px;
  overflow: auto;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--ui-radius, 6px);
  background: var(--panel-2);
  color: var(--muted);
  font-size: 12px;
  line-height: 1.7;
}
.uc-md-heading { color: var(--text); font-weight: 600; font-size: 13px; margin: 8px 0 4px; }
.uc-md-heading:first-child { margin-top: 0; }
.uc-md-item { position: relative; padding-left: 14px; margin: 2px 0; }
.uc-md-item::before {
  content: "";
  position: absolute;
  left: 3px;
  top: 9px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--accent);
}
.uc-md-text { margin: 4px 0; }
.uc-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--muted);
  font-size: 12px;
}
.uc-inline.done { color: var(--accent); }

.uc-history { margin-top: 4px; padding-top: 12px; border-top: 1px solid var(--border); }
.uc-history-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0 0 8px;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.uc-history-toggle:hover { color: var(--text); }
.uc-chevron { transition: transform 0.15s; flex-shrink: 0; }
.uc-chevron.open { transform: rotate(180deg); }
.uc-history-body { display: flex; flex-direction: column; gap: 8px; }
.uc-hint { margin: 0; color: var(--muted); font-size: 11px; }
.uc-history-list { border: 1px solid var(--border); border-radius: var(--ui-radius, 6px); overflow: hidden; }
.uc-history-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
}
.uc-history-row:last-child { border-bottom: none; }
.uc-history-row .uc-muted:last-of-type { margin-left: auto; }
.uc-tag { font-family: ui-monospace, monospace; color: var(--accent); font-size: 12px; }

.uc-panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.uc-panel-title { font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 4px; }
.uc-panel-head p { margin: 0; }
.uc-head-actions { display: flex; gap: 8px; flex-shrink: 0; }
.uc-release-list { display: flex; flex-direction: column; gap: 8px; }
.uc-release-item { border: 1px solid var(--border); border-radius: var(--ui-radius, 6px); background: var(--panel-2); overflow: hidden; }
.uc-release-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  background: transparent;
  color: var(--text);
  text-align: left;
  cursor: pointer;
}
.uc-release-toggle:hover { background: var(--hover); }
.uc-release-toggle .uc-muted { margin-left: auto; }
.uc-tag-badge {
  padding: 2px 7px;
  border: 1px solid var(--border);
  border-radius: var(--ui-radius, 6px);
  background: var(--hover);
  color: var(--text);
  font-family: ui-monospace, monospace;
  font-size: 11px;
  flex-shrink: 0;
}
.uc-new {
  padding: 2px 5px;
  border-radius: 3px;
  background: var(--accent);
  color: var(--panel);
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
  flex-shrink: 0;
}
.uc-release-detail { padding: 10px 12px; border-top: 1px solid var(--border); }
.uc-section-title { color: var(--text); font-size: 12px; font-weight: 600; margin-bottom: 6px; }
.uc-bullet { position: relative; padding-left: 14px; margin: 4px 0; color: var(--muted); font-size: 12px; line-height: 1.6; }
.uc-bullet::before {
  content: "";
  position: absolute;
  left: 3px;
  top: 8px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--muted);
}
.uc-release-detail .uc-btn { margin-top: 8px; }

.uc-spinner {
  width: 22px;
  height: 22px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: uc-spin 0.8s linear infinite;
}
.uc-spinner.sm { width: 14px; height: 14px; }
@keyframes uc-spin { to { transform: rotate(360deg); } }

.uc-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 56px;
  padding: 10px 20px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}
.uc-source { display: flex; align-items: center; gap: 8px; }
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
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: var(--ui-radius, 6px);
  background: var(--panel-2);
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
}
.uc-btn:hover:not(:disabled) { background: var(--hover); }
.uc-btn:disabled { opacity: 0.55; cursor: default; }
.uc-btn.ghost { border-color: transparent; background: transparent; }
.uc-btn.primary { background: var(--accent); border-color: var(--accent); color: var(--panel); }
.uc-btn.primary:hover:not(:disabled) { background: var(--accent); filter: brightness(1.12); }
.uc-btn.sm { height: 28px; padding: 0 10px; font-size: 11px; }
.uc-btn.wide { width: 100%; }
.uc-progress { display: flex; flex-direction: column; gap: 4px; width: 160px; color: var(--muted); font-size: 11px; }
.uc-progress-track { height: 6px; border-radius: 3px; background: var(--hover); overflow: hidden; }
.uc-progress-fill {
  width: 50%;
  height: 100%;
  border-radius: 3px;
  background: var(--accent);
  animation: uc-pulse 1.4s ease-in-out infinite;
}
@keyframes uc-pulse {
  0%, 100% { transform: translateX(-30%); opacity: 0.5; }
  50% { transform: translateX(30%); opacity: 1; }
}
</style>
