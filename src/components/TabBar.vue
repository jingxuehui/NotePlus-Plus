<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import {
  tabsState,
  setActive,
  togglePinned,
  renameTab,
  pinnedCount,
} from "@/stores/tabs";
import { settings } from "@/stores/settings";
import { revealInFinder } from "@/commands";
import { t } from "@/i18n";
import FileTypeIcon from "./FileTypeIcon.vue";

const emit = defineEmits<{
  close: [id: number];
  "close-others": [id: number];
  "close-all": [];
}>();

function onAuxClick(id: number, e: MouseEvent) {
  if (e.button === 1) emit("close", id);
}

// ---------- 右键菜单：重命名 / 固定 / 在 Finder 中显示 / 关闭当前 / 关闭其他 / 关闭全部 ----------
const MENU_W = 184;
const MENU_H = 205;
const menu = ref<{ x: number; y: number; id: number } | null>(null);
const menuTab = computed(
  () => tabsState.tabs.find((t) => t.id === menu.value?.id) ?? null
);

const hasMenuItems = computed(
  () => Object.values(settings.tabMenu).some(Boolean)
);

/** 按设置中的拖拽顺序排列右键菜单项 */
function menuOrder(key: string): number {
  const i = settings.tabMenuOrder.indexOf(key);
  return i < 0 ? 90 : i;
}

function openMenu(id: number, e: MouseEvent) {
  e.preventDefault();
  if (!hasMenuItems.value) return;
  setActive(id);
  menu.value = {
    // 靠近窗口右下角时向内收，避免菜单被裁掉
    x: Math.min(e.clientX, window.innerWidth - MENU_W - 8),
    y: Math.min(e.clientY, window.innerHeight - MENU_H - 8),
    id,
  };
}

function closeMenu() {
  menu.value = null;
}

// ---------- 标签内联重命名：Enter / 失焦提交，Esc 取消 ----------
const renaming = ref<{ id: number; value: string } | null>(null);
const renameInput = ref<HTMLInputElement | null>(null);

function setRenameInput(el: unknown) {
  if (el instanceof HTMLInputElement) renameInput.value = el;
}

function menuRename() {
  if (!menu.value) return;
  const tab = tabsState.tabs.find((t) => t.id === menu.value!.id);
  closeMenu();
  if (!tab) return;
  renaming.value = { id: tab.id, value: tab.name };
  nextTick(() => {
    renameInput.value?.focus();
    renameInput.value?.select();
  });
}

function commitRename(id: number) {
  if (!renaming.value || renaming.value.id !== id) return;
  renameTab(id, renaming.value.value);
  renaming.value = null;
}

function cancelRename() {
  renaming.value = null;
}

function menuPin() {
  if (menu.value) togglePinned(menu.value.id);
  closeMenu();
}

function menuReveal() {
  const path = menuTab.value?.path;
  closeMenu();
  if (!path) return;
  revealInFinder(path).catch((e) => console.error("在 Finder 中显示失败", e));
}

function menuClose() {
  if (menu.value) emit("close", menu.value.id);
  closeMenu();
}

function menuCloseOthers() {
  if (menu.value) emit("close-others", menu.value.id);
  closeMenu();
}

function menuCloseAll() {
  emit("close-all");
  closeMenu();
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    closeMenu();
    cancelRename();
  }
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <!-- 标签页：溢出模式由 body.tab-wrap 驱动（设置里可实时预览） -->
  <div class="tab-strip flex h-9 bg-panel2 border-b border-line overflow-x-auto shrink-0">
    <div
      v-for="(tab, index) in tabsState.tabs"
      :key="tab.id"
      class="tab-item"
      :class="{
        active: tab.id === tabsState.activeId,
        pinned: tab.pinned,
        'pin-end': tab.pinned && index === pinnedCount - 1 && index < tabsState.tabs.length - 1,
      }"
      :title="tab.path ?? tab.name"
      @click="setActive(tab.id)"
      @auxclick="onAuxClick(tab.id, $event)"
      @contextmenu="openMenu(tab.id, $event)"
    >
      <span class="tab-file-icon">
        <FileTypeIcon :path="tab.path" :name="tab.name" :size="14" :dirty="tab.dirty" />
      </span>
      <input
        v-if="renaming?.id === tab.id"
        :ref="setRenameInput"
        v-model="renaming.value"
        class="tab-rename"
        spellcheck="false"
        @click.stop
        @keydown.enter.prevent="commitRename(tab.id)"
        @keydown.esc.prevent="cancelRename"
        @blur="commitRename(tab.id)"
      />
      <span class="tab-name" v-else>{{ tab.name }}</span>
      <span
        class="pin-btn"
        :class="{ on: tab.pinned }"
        :title="tab.pinned ? t('tab.unpinTip') : t('tab.pinTip')"
        @click.stop="togglePinned(tab.id)"
      >
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">
          <path d="M6 2h4M8 2v4M5 6h6l-1 4H6L5 6zM8 10v4" />
        </svg>
      </span>
      <span class="close-btn" :title="t('tab.closeTip')" @click.stop="emit('close', tab.id)">
        <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" stroke-width="1.4">
          <line x1="1" y1="1" x2="9" y2="9" /><line x1="9" y1="1" x2="1" y2="9" />
        </svg>
      </span>
    </div>
  </div>

  <Teleport to="body">
    <div v-if="menu" class="tab-menu-mask" @click="closeMenu" @contextmenu.prevent="closeMenu"></div>
    <div v-if="menu" class="tab-menu" :style="{ left: menu.x + 'px', top: menu.y + 'px' }">
      <button class="tab-menu-item" v-if="settings.tabMenu.rename" :style="{ order: menuOrder('rename') }" @click="menuRename">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11.2 2.4l2.4 2.4-8 8-3.2.8.8-3.2 8-8z" /><path d="M9.8 3.8l2.4 2.4" />
        </svg>
        <span>{{ t("tab.rename") }}</span>
      </button>
      <button class="tab-menu-item" v-if="settings.tabMenu.pin" :style="{ order: menuOrder('pin') }" @click="menuPin">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">
          <path d="M6 2h4M8 2v4M5 6h6l-1 4H6L5 6zM8 10v4" />
        </svg>
        <span>{{ menuTab?.pinned ? t("tab.unpin") : t("tab.pin") }}</span>
      </button>
      <button class="tab-menu-item" v-if="settings.tabMenu.reveal && menuTab?.path" :style="{ order: menuOrder('reveal') }" @click="menuReveal">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2.5 4.5a1.5 1.5 0 0 1 1.5-1.5h2l1.2 1.5h5.3a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5H4a1.5 1.5 0 0 1-1.5-1.5z" />
        </svg>
        <span>{{ t("tab.reveal") }}</span>
      </button>
      <div
        class="tab-menu-sep"
        v-if="(settings.tabMenu.rename || settings.tabMenu.pin || (settings.tabMenu.reveal && menuTab?.path)) && (settings.tabMenu.close || settings.tabMenu.closeOthers || settings.tabMenu.closeAll)"
        :style="{ order: menuOrder('close') - 0.5 }"
      ></div>
      <button class="tab-menu-item" v-if="settings.tabMenu.close" :style="{ order: menuOrder('close') }" @click="menuClose">
        <svg width="12" height="12" viewBox="0 0 10 10" stroke="currentColor" stroke-width="1.3">
          <line x1="1.5" y1="1.5" x2="8.5" y2="8.5" /><line x1="8.5" y1="1.5" x2="1.5" y2="8.5" />
        </svg>
        <span>{{ t("tab.close") }}</span>
      </button>
      <button class="tab-menu-item" :style="{ order: menuOrder('closeOthers') }" @click="menuCloseOthers" v-if="settings.tabMenu.closeOthers && tabsState.tabs.length > 1">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
          <rect x="2" y="3" width="12" height="10" rx="2" /><path d="M2 6.5h12M5 4.7h.01M8 4.7h.01" />
        </svg>
        <span>{{ t("tab.closeOthers") }}</span>
      </button>
      <button class="tab-menu-item" v-if="settings.tabMenu.closeAll" :style="{ order: menuOrder('closeAll') }" @click="menuCloseAll">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
          <rect x="2" y="3" width="12" height="10" rx="2" /><path d="M5.5 6.5l5 3M10.5 6.5l-5 3" />
        </svg>
        <span>{{ t("tab.closeAll") }}</span>
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.tab-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 100%;
  padding: 0 8px 0 12px;
  max-width: 200px;
  border-right: 1px solid var(--border);
  color: var(--muted);
  cursor: pointer;
  font-size: 12px;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
}
.tab-item:hover {
  background: var(--hover);
}
.tab-item.active {
  background: var(--panel);
  color: var(--text);
  box-shadow: inset 0 -2px 0 var(--accent);
}
.tab-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tab-rename {
  flex: 1;
  min-width: 60px;
  width: 100%;
  height: 20px;
  padding: 0 4px;
  color: var(--text);
  background: var(--panel);
  border: 1px solid var(--accent);
  border-radius: 4px;
  outline: none;
  font-size: 12px;
  user-select: text;
}
.close-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 4px;
  opacity: 0.6;
  flex-shrink: 0;
}
.tab-item:hover .close-btn {
  opacity: 0.9;
}
.close-btn:hover {
  opacity: 1 !important;
  background: var(--hover);
}

/* 文件类型图标：所有布局均显示（未保存状态由图标外圈的强调色提示） */
.tab-file-icon {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}

/* 置顶按钮：常显（悬停加深）；已置顶时用强调色突出。放在关闭按钮左侧，左键即可切换 */
.pin-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 4px;
  color: var(--muted);
  opacity: 0.55;
  flex-shrink: 0;
}
.tab-item:hover .pin-btn {
  opacity: 0.9;
}
.pin-btn.on {
  color: var(--accent);
  opacity: 0.95;
}
.pin-btn:hover {
  opacity: 1 !important;
  background: var(--hover);
  color: var(--accent);
}
.tab-item.pin-end {
  border-right-color: var(--accent);
}
.tab-item.pinned .tab-name {
  color: var(--text);
}

/* ===== 右键菜单 ===== */
.tab-menu-mask {
  position: fixed;
  inset: 0;
  z-index: 900;
}
.tab-menu {
  position: fixed;
  z-index: 901;
  display: flex;
  flex-direction: column;
  min-width: 168px;
  padding: 4px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
}
.tab-menu-item {
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
.tab-menu-item:hover {
  background: var(--hover);
}
.tab-menu-sep {
  height: 1px;
  margin: 4px 6px;
  background: var(--border);
}

/* ===== 多行平铺：标签换行堆叠，最多约 4 行，超出后纵向滚动 ===== */
body.tab-wrap .tab-strip {
  flex-wrap: wrap;
  align-content: flex-start;
  height: auto;
  max-height: 160px;
  overflow-x: hidden;
  overflow-y: auto;
}
body.tab-wrap .tab-strip .tab-item {
  height: 36px;
}

/* ===== 现代分窗：标签变为独立圆角胶囊 ===== */
body.layout-modern .tab-strip {
  padding: 5px 8px;
  gap: 6px;
  background: transparent;
  scrollbar-width: none;
}
body.layout-modern.tab-wrap .tab-strip {
  max-height: 160px;
}
body.layout-modern.tab-wrap .tab-strip .tab-item {
  height: 26px;
  align-self: flex-start;
}
body.layout-modern .tab-strip::-webkit-scrollbar {
  height: 0;
}
body.layout-modern .tab-item {
  align-self: center;
  height: 26px;
  border: 1px solid transparent;
  border-radius: 10px;
  padding: 0 8px 0 10px;
  background: var(--panel-2);
  color: var(--muted);
  box-shadow: none;
}
body.layout-modern .tab-item:hover {
  background: var(--hover);
}
body.layout-modern .tab-item.active {
  background: var(--accent-tint);
  border-color: var(--accent-edge);
  color: var(--text);
  box-shadow: none;
}
body.layout-modern .tab-file-icon {
  color: var(--accent);
}
body.layout-modern .close-btn {
  opacity: 0.6;
}
body.layout-modern .tab-item:hover .close-btn {
  opacity: 0.9;
}
body.layout-modern .close-btn:hover {
  background: var(--accent-tint);
}
body.layout-modern .pin-btn {
  opacity: 0.55;
}
body.layout-modern .pin-btn.on {
  opacity: 1;
}
body.layout-modern .tab-item:hover .pin-btn {
  opacity: 0.9;
}
body.layout-modern .pin-btn:hover {
  background: var(--accent-tint);
}
/* 现代分窗：固定区与普通区之间用一条竖线分隔（胶囊之间本身有间隙，不能靠右边框） */
body.layout-modern .tab-item.pin-end {
  border-right-color: transparent;
  margin-right: 8px;
}
body.layout-modern .tab-item.pin-end::after {
  content: "";
  position: absolute;
  right: -7px;
  top: 50%;
  width: 1px;
  height: 14px;
  transform: translateY(-50%);
  background: var(--border);
}
</style>
