<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { EditorView, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { bracketMatching, foldGutter, indentOnInput, indentUnit } from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { json } from "@codemirror/lang-json";
import { toggleTools } from "@/stores/ui";
import { settings } from "@/stores/settings";
import { darkTheme, lightTheme } from "@/editor/themes";
import { notify } from "@/stores/toast";
import { md5 } from "@/utils/md5";

type TabId = "json-diff" | "crypto";
const activeTab = ref<TabId>("json-diff");

// ---------- JSON 对比 ----------
const leftJson = ref("");
const rightJson = ref("");
const diffError = ref("");
const diffResult = ref<DiffRow[] | null>(null);
type DiffFilter = "all" | DiffRow["type"];
const diffFilter = ref<DiffFilter>("all");

// 左右 JSON 用 CodeMirror：语法高亮 + 行号 + 自动缩进
const leftEditorEl = ref<HTMLElement | null>(null);
const rightEditorEl = ref<HTMLElement | null>(null);
let leftView: EditorView | null = null;
let rightView: EditorView | null = null;
const themeComp = new Compartment();

function jsonExtensions(onChange: (text: string) => void) {
  return [
    lineNumbers(),
    highlightActiveLine(),
    history(),
    foldGutter(),
    indentOnInput(),
    indentUnit.of("  "),
    bracketMatching(),
    closeBrackets(),
    keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
    json(),
    themeComp.of(settings.theme === "light" ? lightTheme() : darkTheme()),
    EditorView.lineWrapping,
    EditorView.theme({
      "&": { height: "100%", backgroundColor: "var(--panel-2)", fontSize: "12px" },
      ".cm-scroller": { fontFamily: "'SF Mono', Menlo, Monaco, 'Courier New', monospace", lineHeight: "1.6" },
      ".cm-content": { padding: "8px 0" },
      ".cm-gutters": { backgroundColor: "var(--panel-2)", border: "none", borderRight: "1px solid var(--border)" },
    }),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) onChange(update.state.doc.toString());
    }),
  ];
}

function setEditorText(view: EditorView | null, text: string) {
  if (view) view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
}

onMounted(() => {
  if (leftEditorEl.value) {
    leftView = new EditorView({
      state: EditorState.create({ doc: leftJson.value, extensions: jsonExtensions((t) => { leftJson.value = t; }) }),
      parent: leftEditorEl.value,
    });
  }
  if (rightEditorEl.value) {
    rightView = new EditorView({
      state: EditorState.create({ doc: rightJson.value, extensions: jsonExtensions((t) => { rightJson.value = t; }) }),
      parent: rightEditorEl.value,
    });
  }
});
watch(() => settings.theme, () => {
  const ext = settings.theme === "light" ? lightTheme() : darkTheme();
  leftView?.dispatch({ effects: themeComp.reconfigure(ext) });
  rightView?.dispatch({ effects: themeComp.reconfigure(ext) });
});

interface DiffRow {
  path: string;
  type: "same" | "added" | "removed" | "changed";
  left: string;
  right: string;
}

function display(v: unknown): string {
  if (v === undefined) return "—";
  if (typeof v === "string") return v;
  try { return JSON.stringify(v); } catch { return String(v); }
}

function compareValues(a: unknown, b: unknown, path: string, out: DiffRow[]) {
  const typeOf = (v: unknown) => Array.isArray(v) ? "array" : v === null ? "null" : typeof v;
  const ta = typeOf(a);
  const tb = typeOf(b);
  if (ta !== tb) {
    out.push({ path, type: "changed", left: display(a), right: display(b) });
    return;
  }
  if (ta === "object" || ta === "array") {
    const objA = a as Record<string, unknown>;
    const objB = b as Record<string, unknown>;
    const keys = new Set([...Object.keys(objA), ...Object.keys(objB)]);
    for (const key of keys) {
      const child = ta === "array" ? `${path}[${key}]` : `${path}${path === "$" ? "." : ""}${key}`;
      const inA = Object.prototype.hasOwnProperty.call(objA, key);
      const inB = Object.prototype.hasOwnProperty.call(objB, key);
      if (inA && !inB) out.push({ path: child, type: "removed", left: display(objA[key]), right: "—" });
      else if (!inA && inB) out.push({ path: child, type: "added", left: "—", right: display(objB[key]) });
      else compareValues(objA[key], objB[key], child, out);
    }
  } else if (a !== b) {
    out.push({ path, type: "changed", left: display(a), right: display(b) });
  } else {
    out.push({ path, type: "same", left: display(a), right: display(b) });
  }
}

function runDiff() {
  diffError.value = "";
  diffResult.value = null;
  diffFilter.value = "all";
  try {
    if (!leftJson.value.trim() || !rightJson.value.trim()) throw new Error("请先填写左右两侧的 JSON 内容");
    const a = JSON.parse(leftJson.value);
    const b = JSON.parse(rightJson.value);
    const rows: DiffRow[] = [];
    compareValues(a, b, "$", rows);
    diffResult.value = rows;
  } catch (e) {
    diffError.value = e instanceof Error ? e.message : String(e);
  }
}

function formatJson(side: "left" | "right") {
  const target = side === "left" ? leftJson : rightJson;
  const view = side === "left" ? leftView : rightView;
  try {
    const value = JSON.parse(target.value);
    // 2 空格缩进写回编辑器，保持高亮与行号
    setEditorText(view, JSON.stringify(value, null, 2));
    diffError.value = "";
  } catch (e) {
    diffError.value = `${side === "left" ? "左侧" : "右侧"} JSON 解析失败：${e instanceof Error ? e.message : String(e)}`;
  }
}

function swapJson() {
  const left = leftJson.value;
  const right = rightJson.value;
  setEditorText(leftView, right);
  setEditorText(rightView, left);
  diffResult.value = null;
}

const diffCounts = computed(() => {
  const rows = diffResult.value ?? [];
  return {
    same: rows.filter((r) => r.type === "same").length,
    added: rows.filter((r) => r.type === "added").length,
    removed: rows.filter((r) => r.type === "removed").length,
    changed: rows.filter((r) => r.type === "changed").length,
  };
});
const visibleDiffRows = computed(() => {
  const rows = diffResult.value ?? [];
  return diffFilter.value === "all" ? rows : rows.filter((r) => r.type === diffFilter.value);
});

function loadDiffSample() {
  setEditorText(leftView, JSON.stringify({
    name: "NotePlus+", version: "0.1.4", editor: { theme: "dark", fontSize: 14 },
    languages: ["json", "rust", "vue"], features: { find: true, format: false }
  }, null, 2));
  setEditorText(rightView, JSON.stringify({
    name: "NotePlus+", version: "0.1.5", editor: { theme: "light", fontSize: 16 },
    languages: ["json", "rust", "vue", "sql"], features: { find: true, format: true }
  }, null, 2));
  diffResult.value = null;
  diffError.value = "";
}

// ---------- 加解密 ----------
type CryptoFormat = "base64" | "aes" | "md5" | "sha1" | "sha256" | "sha512";
const cryptoFormat = ref<CryptoFormat>("base64");
const cryptoAction = ref<"encode" | "decode">("encode");
const cryptoInput = ref("");
const cryptoOutput = ref("");
const cryptoPassword = ref("");
const cryptoError = ref("");
const cryptoBusy = ref(false);
const hashPerLine = ref(false);

const formatOptions: { value: CryptoFormat; label: string }[] = [
  { value: "base64", label: "Base64" },
  { value: "aes", label: "AES-GCM" },
  { value: "md5", label: "MD5" },
  { value: "sha1", label: "SHA-1" },
  { value: "sha256", label: "SHA-256" },
  { value: "sha512", label: "SHA-512" },
];
const isHash = computed(() => ["md5", "sha1", "sha256", "sha512"].includes(cryptoFormat.value));
const needPassword = computed(() => cryptoFormat.value === "aes");
const actionLabel = computed(() => {
  if (isHash.value) return "生成";
  return cryptoFormat.value === "base64"
    ? (cryptoAction.value === "encode" ? "编码" : "解码")
    : (cryptoAction.value === "encode" ? "加密" : "解密");
});

const enc = new TextEncoder();
const dec = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}
function fromBase64(text: string): Uint8Array {
  const binary = atob(text.replace(/\s+/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 100000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}
/** AES 输出格式：BASE64(salt[16] | iv[12] | ciphertext) */
async function aesEncrypt(text: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const cipher = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource }, key, enc.encode(text)
  ));
  const packed = new Uint8Array(salt.length + iv.length + cipher.length);
  packed.set(salt, 0);
  packed.set(iv, salt.length);
  packed.set(cipher, salt.length + iv.length);
  return toBase64(packed);
}
async function aesDecrypt(payload: string, password: string): Promise<string> {
  const packed = fromBase64(payload);
  if (packed.length < 28) throw new Error("密文格式不正确（应包含盐与 IV）");
  const salt = packed.slice(0, 16);
  const iv = packed.slice(16, 28);
  const cipher = packed.slice(28);
  const key = await deriveKey(password, salt);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource }, key, cipher as BufferSource
  );
  return dec.decode(plain);
}

async function hashText(text: string): Promise<string> {
  switch (cryptoFormat.value) {
    case "md5": return md5(text);
    case "sha1": return toHex(new Uint8Array(await crypto.subtle.digest("SHA-1", enc.encode(text))));
    case "sha256": return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(text))));
    case "sha512": return toHex(new Uint8Array(await crypto.subtle.digest("SHA-512", enc.encode(text))));
    default: throw new Error("未选择摘要算法");
  }
}

async function runCrypto() {
  cryptoError.value = "";
  cryptoOutput.value = "";
  if (!cryptoInput.value) { cryptoError.value = "请输入内容"; return; }
  if (needPassword.value && !cryptoPassword.value) { cryptoError.value = "请输入密码"; return; }
  cryptoBusy.value = true;
  try {
    const encode = cryptoAction.value === "encode";
    if (isHash.value) {
      if (hashPerLine.value) {
        const lines = cryptoInput.value.replace(/\r\n/g, "\n").split("\n");
        const results: string[] = [];
        for (const line of lines) {
          // 空行也保留一行结果，方便逐行对应
          results.push(await hashText(line));
        }
        cryptoOutput.value = results.join("\n");
      } else {
        cryptoOutput.value = await hashText(cryptoInput.value);
      }
      return;
    }
    switch (cryptoFormat.value) {
      case "base64":
        cryptoOutput.value = encode ? toBase64(enc.encode(cryptoInput.value)) : dec.decode(fromBase64(cryptoInput.value));
        break;
      case "aes":
        cryptoOutput.value = encode
          ? await aesEncrypt(cryptoInput.value, cryptoPassword.value)
          : await aesDecrypt(cryptoInput.value, cryptoPassword.value);
        break;
    }
  } catch (e) {
    cryptoError.value = `操作失败：${e instanceof Error ? e.message : String(e)}`;
  } finally {
    cryptoBusy.value = false;
  }
}

function swapCrypto() {
  const tmp = cryptoInput.value;
  cryptoInput.value = cryptoOutput.value;
  cryptoOutput.value = tmp;
  cryptoError.value = "";
}
async function copyOutput() {
  if (!cryptoOutput.value) return;
  try {
    await navigator.clipboard.writeText(cryptoOutput.value);
    notify("已复制到剪贴板", false);
  } catch {
    notify("复制失败，请手动选择文本复制");
  }
}

function close() { toggleTools(false); }
function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") { e.stopPropagation(); close(); }
}
onMounted(() => window.addEventListener("keydown", onKeydown, true));
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown, true);
  leftView?.destroy();
  rightView?.destroy();
});
</script>

<template>
  <Teleport to="body">
    <div class="tools-overlay" @click.self="close">
      <div class="tools-window">
        <header class="tools-header">
          <span class="tools-title">工具箱</span>
          <span class="tools-spacer"></span>
          <span class="tools-close" title="关闭" @click="close">
            <svg width="12" height="12" viewBox="0 0 10 10" stroke="currentColor" stroke-width="1.4">
              <line x1="1" y1="1" x2="9" y2="9" /><line x1="9" y1="1" x2="1" y2="9" />
            </svg>
          </span>
        </header>

        <div class="tools-tabs">
          <button :class="{ on: activeTab === 'json-diff' }" @click="activeTab = 'json-diff'">JSON 对比</button>
          <button :class="{ on: activeTab === 'crypto' }" @click="activeTab = 'crypto'">加解密</button>
        </div>

        <div v-if="activeTab === 'json-diff'" class="tools-body diff-body">
          <div class="diff-toolbar">
            <button class="tool-btn" @click="loadDiffSample">载入示例</button>
            <button class="tool-btn" @click="formatJson('left')">格式化左</button>
            <button class="tool-btn" @click="formatJson('right')">格式化右</button>
            <button class="tool-btn" @click="swapJson">交换</button>
            <span class="tools-spacer"></span>
            <button class="tool-btn primary" @click="runDiff">对比</button>
          </div>
          <p v-if="diffError" class="tool-error">{{ diffError }}</p>
          <div class="diff-editors">
            <div class="diff-col">
              <div class="diff-col-head">左侧 JSON</div>
              <div ref="leftEditorEl" class="json-editor"></div>
            </div>
            <div class="diff-col">
              <div class="diff-col-head">右侧 JSON</div>
              <div ref="rightEditorEl" class="json-editor"></div>
            </div>
          </div>
          <div v-if="diffResult" class="diff-result">
            <div class="diff-result-head">
              <span>对比结果</span>
              <button class="diff-stat" :class="{ on: diffFilter === 'all' }" @click="diffFilter = 'all'">全部 {{ (diffResult ?? []).length }}</button>
              <button class="diff-stat same" :class="{ on: diffFilter === 'same' }" @click="diffFilter = 'same'">相同 {{ diffCounts.same }}</button>
              <button class="diff-stat added" :class="{ on: diffFilter === 'added' }" @click="diffFilter = 'added'">新增 {{ diffCounts.added }}</button>
              <button class="diff-stat removed" :class="{ on: diffFilter === 'removed' }" @click="diffFilter = 'removed'">删除 {{ diffCounts.removed }}</button>
              <button class="diff-stat changed" :class="{ on: diffFilter === 'changed' }" @click="diffFilter = 'changed'">修改 {{ diffCounts.changed }}</button>
            </div>
            <div class="diff-list">
              <div v-if="!visibleDiffRows.length" class="diff-empty">没有差异，两侧内容一致。</div>
              <div v-for="(row, i) in visibleDiffRows" :key="i" class="diff-row" :class="row.type">
                <span class="diff-badge">{{ { same: '相同', added: '新增', removed: '删除', changed: '修改' }[row.type] }}</span>
                <span class="diff-path">{{ row.path }}</span>
                <span class="diff-value">左：{{ row.left }}</span>
                <span class="diff-value">右：{{ row.right }}</span>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="tools-body crypto-body">
          <div class="crypto-toolbar">
            <label class="crypto-label">算法</label>
            <select v-model="cryptoFormat" class="tool-select" @change="cryptoAction = 'encode'; cryptoOutput = ''; cryptoError = ''">
              <option v-for="opt in formatOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
            <template v-if="needPassword">
              <label class="crypto-label">密码</label>
              <input v-model="cryptoPassword" type="password" class="tool-input" placeholder="加密/解密密码" />
            </template>
            <label v-if="isHash" class="crypto-check">
              <input type="checkbox" v-model="hashPerLine" /> 按行分别生成
            </label>
            <span class="tools-spacer"></span>
            <template v-if="!isHash">
              <button
                class="tool-btn"
                :class="{ primary: cryptoAction === 'encode' }"
                :disabled="cryptoBusy"
                @click="cryptoAction = 'encode'; runCrypto()"
              >{{ cryptoFormat === 'base64' ? '编码' : '加密' }}</button>
              <button
                class="tool-btn"
                :class="{ primary: cryptoAction === 'decode' }"
                :disabled="cryptoBusy"
                @click="cryptoAction = 'decode'; runCrypto()"
              >{{ cryptoFormat === 'base64' ? '解码' : '解密' }}</button>
            </template>
            <button v-else class="tool-btn primary" :disabled="cryptoBusy" @click="runCrypto">
              {{ cryptoBusy ? "处理中…" : "生成" }}
            </button>
          </div>
          <p v-if="cryptoError" class="tool-error">{{ cryptoError }}</p>
          <div class="crypto-fields">
            <div class="crypto-col">
              <div class="diff-col-head">输入</div>
              <textarea v-model="cryptoInput" class="tool-textarea" spellcheck="false" placeholder="输入待处理内容…"></textarea>
            </div>
            <div class="crypto-actions">
              <button class="tool-btn" title="交换输入输出" @click="swapCrypto">⇄</button>
            </div>
            <div class="crypto-col">
              <div class="diff-col-head">输出</div>
              <textarea :value="cryptoOutput" class="tool-textarea" readonly spellcheck="false" placeholder="结果显示在这里…"></textarea>
            </div>
          </div>
          <div class="crypto-footer">
            <button class="tool-btn" :disabled="!cryptoOutput" @click="copyOutput">复制结果</button>
            <button class="tool-btn" @click="cryptoInput = ''; cryptoOutput = ''; cryptoError = ''">清空</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.tools-overlay {
  position: fixed;
  inset: 0;
  z-index: 75;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: max(28px, calc((100vh - 700px) / 2));
  background: rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(3px);
}
.tools-window {
  width: min(940px, 94vw);
  max-height: min(700px, 88vh);
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: calc(var(--ui-radius, 6px) + 4px);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.6);
  overflow: hidden;
  font-size: 13px;
}
.tools-header {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.tools-title { font-size: 15px; font-weight: 600; color: var(--text); }
.tools-spacer { flex: 1; }
.tools-close {
  display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border-radius: var(--ui-radius, 6px);
  color: var(--muted); cursor: pointer;
}
.tools-close:hover { background: var(--hover); color: var(--text); }
.tools-tabs {
  display: flex; align-items: center; gap: 22px; height: 40px;
  padding: 0 18px; border-bottom: 1px solid var(--border); flex-shrink: 0;
}
.tools-tabs button {
  position: relative; height: 40px; padding: 0 2px;
  border: none; background: transparent; color: var(--muted);
  font-size: 13px; cursor: pointer;
}
.tools-tabs button.on { color: var(--text); font-weight: 600; }
.tools-tabs button.on::after {
  content: ""; position: absolute; left: 0; right: 0; bottom: 0;
  height: 2px; border-radius: 2px; background: var(--accent);
}
.tools-body { flex: 1; min-height: 0; overflow: auto; padding: 14px 18px 18px; display: flex; flex-direction: column; gap: 10px; }
.diff-toolbar, .crypto-toolbar, .crypto-footer {
  display: flex; align-items: center; gap: 8px; flex-shrink: 0;
}
.tool-btn {
  height: 28px; padding: 0 10px; border: 1px solid var(--border);
  border-radius: var(--ui-radius, 6px); background: var(--panel-2);
  color: var(--text); font-size: 12px; cursor: pointer;
}
.tool-btn:hover:not(:disabled) { background: var(--hover); }
.tool-btn:disabled { opacity: 0.5; cursor: default; }
.tool-btn.primary { background: var(--accent); border-color: var(--accent); color: var(--panel); font-weight: 500; }
.tool-btn.primary:hover:not(:disabled) { filter: brightness(1.12); background: var(--accent); }
.tool-error { margin: 0; color: var(--text); font-size: 12px; }
.diff-editors { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; min-height: 180px; flex: 1; }
.json-editor {
  flex: 1; min-height: 150px; overflow: hidden;
  border: 1px solid var(--border); border-radius: var(--ui-radius, 6px);
  background: var(--panel-2);
}
.json-editor:focus-within { border-color: var(--accent); }
.json-editor .cm-editor { height: 100%; }
.diff-col, .crypto-col { display: flex; flex-direction: column; min-height: 0; gap: 6px; }
.diff-col-head { color: var(--muted); font-size: 12px; }
.tool-textarea {
  width: 100%; flex: 1; min-height: 150px; resize: vertical;
  background: var(--panel-2); border: 1px solid var(--border);
  border-radius: var(--ui-radius, 6px); padding: 10px; color: var(--text);
  font-family: "'SF Mono', Menlo, Monaco, monospace"; font-size: 12px;
  line-height: 1.6; outline: none; user-select: text;
}
.tool-textarea:focus { border-color: var(--accent); }
.diff-result { border-top: 1px solid var(--border); padding-top: 10px; display: flex; flex-direction: column; gap: 8px; min-height: 160px; }
.diff-result-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 12px; color: var(--text); }
.diff-stat {
  height: 20px; padding: 0 7px; border: 1px solid transparent;
  border-radius: var(--ui-radius, 6px); background: transparent;
  color: var(--muted); font-size: 11px; cursor: pointer;
}
.diff-stat:hover { background: var(--hover); }
.diff-stat.on { border-color: var(--accent-edge, var(--border)); background: var(--accent-tint, var(--hover)); color: var(--accent); }
.diff-stat.same { color: var(--muted); }
.diff-stat.added { color: var(--accent); }
.diff-stat.removed { color: var(--text); }
.diff-stat.changed { color: var(--accent); }
.diff-list { overflow: auto; max-height: 220px; border: 1px solid var(--border); border-radius: var(--ui-radius, 6px); }
.diff-empty { padding: 14px; color: var(--muted); font-size: 12px; text-align: center; }
.diff-row { display: grid; grid-template-columns: 46px minmax(120px, 1fr) minmax(100px, 1fr) minmax(100px, 1fr); gap: 8px; padding: 6px 10px; border-bottom: 1px solid var(--border); font-size: 12px; align-items: start; }
.diff-row:last-child { border-bottom: none; }
.diff-row.same { opacity: 0.6; }
.diff-row.added { background: var(--accent-tint, var(--hover)); }
.diff-row.removed { background: var(--hover); }
.diff-row.changed { background: var(--accent-tint, var(--hover)); }
.diff-badge { font-size: 11px; }
.diff-row.added .diff-badge, .diff-row.changed .diff-badge { color: var(--accent); }
.diff-row.removed .diff-badge { color: var(--text); }
.diff-path { color: var(--accent); font-family: ui-monospace, monospace; word-break: break-all; }
.diff-value { color: var(--muted); word-break: break-all; font-family: ui-monospace, monospace; }
.crypto-label { color: var(--muted); font-size: 12px; }
.crypto-check { display: inline-flex; align-items: center; gap: 5px; color: var(--muted); font-size: 12px; cursor: pointer; }
.crypto-check input { accent-color: var(--accent); cursor: pointer; }
.tool-select, .tool-input {
  height: 28px; padding: 0 8px; background: var(--panel-2);
  border: 1px solid var(--border); border-radius: var(--ui-radius, 6px);
  color: var(--text); font-size: 12px; outline: none;
}
.tool-input { width: 180px; }
.tool-select:focus, .tool-input:focus { border-color: var(--accent); }
.crypto-fields { display: grid; grid-template-columns: 1fr 32px 1fr; gap: 8px; flex: 1; min-height: 220px; }
.crypto-actions { display: flex; align-items: center; justify-content: center; }
.crypto-footer { justify-content: flex-end; }
</style>
