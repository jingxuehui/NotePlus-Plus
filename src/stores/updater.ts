import { computed, ref } from "vue";
import { getVersion } from "@tauri-apps/api/app";
import { settings } from "./settings";
import {
  downloadAsset,
  fetchReleases,
  restartAndUpdate,
  type ReleaseAsset,
  type ReleaseInfo,
} from "@/commands";

const appVersion = ref(__APP_VERSION__);
const source = ref<"github" | "gitee">("github");
const releases = ref<ReleaseInfo[]>([]);
const checking = ref(false);
const loading = ref(false);
const loadError = ref("");
const downloading = ref(false);
const downloadError = ref("");
const downloadedPath = ref("");
let initialized = false;

function compareVersions(a: string, b: string): number {
  const parse = (v: string) =>
    v.replace(/^v/i, "").split(/[.-]/).map((p) => Number.parseInt(p, 10) || 0);
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

const latest = computed<ReleaseInfo | null>(() => releases.value[0] ?? null);
const olderReleases = computed(() => releases.value.slice(1));
const hasUpdate = computed(() => {
  const r = latest.value;
  if (!r || !r.tag || settings.ignoredVersion === r.tag) return false;
  return compareVersions(r.tag, appVersion.value) > 0;
});
const isDownloaded = computed(() => !!downloadedPath.value);
const updateVersion = computed(() => latest.value?.tag ?? "");
const downloadState = computed<"idle" | "downloading" | "done" | "error">(() => {
  if (!hasUpdate.value) return "idle";
  if (downloading.value) return "downloading";
  if (isDownloaded.value) return "done";
  if (downloadError.value) return "error";
  return "idle";
});

/** 按当前平台挑选安装包：macOS 优先 aarch64 dmg */
function pickAsset(release: ReleaseInfo): ReleaseAsset | null {
  const assets = release.assets ?? [];
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("windows")) {
    return assets.find((a) => /\.msi$/i.test(a.name))
      ?? assets.find((a) => /\.exe$/i.test(a.name))
      ?? null;
  }
  if (ua.includes("linux")) {
    return assets.find((a) => /\.appimage$/i.test(a.name))
      ?? assets.find((a) => /\.deb$/i.test(a.name))
      ?? null;
  }
  return assets.find((a) => /aarch64.*\.dmg$/i.test(a.name))
    ?? assets.find((a) => /\.dmg$/i.test(a.name))
    ?? assets.find((a) => /\.app\.tar\.gz$/i.test(a.name))
    ?? null;
}

/** 后台自动下载：缓存中已有则立即复用；检查/下载中不改变任何按钮状态 */
async function ensureDownloaded() {
  const r = latest.value;
  if (!hasUpdate.value || !r || downloading.value || downloadedPath.value) return;
  const asset = pickAsset(r);
  if (!asset) {
    downloadError.value = "该版本没有找到匹配的安装包";
    return;
  }
  downloading.value = true;
  downloadError.value = "";
  try {
    const result = await downloadAsset(asset.downloadUrl, asset.name);
    downloadedPath.value = result.path;
  } catch (e) {
    downloadError.value = e instanceof Error ? e.message : String(e);
  } finally {
    downloading.value = false;
  }
}

async function checkForUpdates() {
  if (loading.value) return;
  loading.value = true;
  loadError.value = "";
  try {
    const data = await fetchReleases(source.value);
    if (!Array.isArray(data)) throw new Error("发布信息格式错误");
    releases.value = data.map((r) => ({
      tag: r.tag ?? "",
      name: r.name ?? "",
      body: typeof r.body === "string" ? r.body : "",
      publishedAt: r.publishedAt ?? "",
      htmlUrl: r.htmlUrl ?? "",
      prerelease: !!r.prerelease,
      assets: Array.isArray(r.assets) ? r.assets : [],
    }));
    if (settings.autoUpdate) void ensureDownloaded();
  } catch (e) {
    releases.value = [];
    loadError.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

async function refreshManually() {
  if (checking.value) return;
  checking.value = true;
  try {
    await checkForUpdates();
  } finally {
    checking.value = false;
  }
}

async function install() {
  if (!downloadedPath.value) return;
  await restartAndUpdate(downloadedPath.value);
}

function ignore() {
  const r = latest.value;
  if (!r) return;
  settings.ignoredVersion = r.tag;
  downloadedPath.value = "";
  downloadError.value = "";
}

/** 启动时初始化：更新按钮隐藏时不做后台检查与下载 */
function initUpdater() {
  if (initialized) return;
  initialized = true;
  getVersion()
    .then((v) => { appVersion.value = v; })
    .catch(() => { /* 使用编译期版本 */ });
  if (settings.autoUpdate && settings.toolbar.updateButton) {
    void checkForUpdates();
  }
}

export const updater = {
  appVersion,
  source,
  releases,
  checking,
  downloading,
  loading,
  loadError,
  downloadError,
  latest,
  olderReleases,
  hasUpdate,
  isDownloaded,
  updateVersion,
  downloadState,
  checkForUpdates,
  refreshManually,
  ensureDownloaded,
  install,
  ignore,
  initUpdater,
};
