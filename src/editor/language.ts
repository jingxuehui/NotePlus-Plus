import type { Extension } from "@codemirror/state";
import { LanguageSupport, StreamLanguage, type StreamParser } from "@codemirror/language";

// 语言包名与加载器分开：名称用于状态栏显示（同步、零依赖），
// 语法包本身按需 import，避免启动时把 20+ 套 Lezer 语法全部求值。
const NAMES: Record<string, string> = {
  js: "JavaScript", mjs: "JavaScript", cjs: "JavaScript",
  jsx: "JSX",
  ts: "TypeScript", mts: "TypeScript", tsx: "TypeScript JSX",
  vue: "Vue",
  html: "HTML", htm: "HTML",
  xml: "XML", svg: "XML",
  css: "CSS", scss: "CSS", less: "CSS",
  json: "JSON", jsonc: "JSON",
  md: "Markdown", markdown: "Markdown",
  py: "Python", pyw: "Python",
  rs: "Rust",
  java: "Java",
  c: "C", h: "C",
  cpp: "C++", cc: "C++", cxx: "C++", hpp: "C++",
  go: "Go",
  sql: "SQL",
  php: "PHP",
  yaml: "YAML", yml: "YAML",
  sh: "Shell", bash: "Shell", zsh: "Shell",
  rb: "Ruby",
  lua: "Lua",
  toml: "TOML",
  ini: "INI", conf: "INI", properties: "INI", cfg: "INI", env: "INI",
  dockerfile: "Dockerfile",
};

type LangLoader = () => Promise<LanguageSupport>;
const JS = () => import("@codemirror/lang-javascript");
const HTML = () => import("@codemirror/lang-html");
const CSS = () => import("@codemirror/lang-css");
const JSON_LANG = () => import("@codemirror/lang-json");
const MD = () => import("@codemirror/lang-markdown");
const PY = () => import("@codemirror/lang-python");
const CPP = () => import("@codemirror/lang-cpp");
const XML = () => import("@codemirror/lang-xml");
const YAML = () => import("@codemirror/lang-yaml");
const PROPERTIES = () => import("@codemirror/legacy-modes/mode/properties");

const stream = (mod: Promise<unknown>, key: string): Promise<LanguageSupport> =>
  mod.then((m) => new LanguageSupport(StreamLanguage.define((m as Record<string, StreamParser<unknown>>)[key])));

const LOADERS: Record<string, LangLoader> = {
  js: () => JS().then((m) => m.javascript()),
  mjs: () => JS().then((m) => m.javascript()),
  cjs: () => JS().then((m) => m.javascript()),
  jsx: () => JS().then((m) => m.javascript({ jsx: true })),
  ts: () => JS().then((m) => m.javascript({ typescript: true })),
  mts: () => JS().then((m) => m.javascript({ typescript: true })),
  tsx: () => JS().then((m) => m.javascript({ typescript: true, jsx: true })),
  vue: () => import("@codemirror/lang-vue").then((m) => m.vue()),
  html: () => HTML().then((m) => m.html()),
  htm: () => HTML().then((m) => m.html()),
  xml: () => XML().then((m) => m.xml()),
  svg: () => XML().then((m) => m.xml()),
  css: () => CSS().then((m) => m.css()),
  scss: () => CSS().then((m) => m.css()),
  less: () => CSS().then((m) => m.css()),
  json: () => JSON_LANG().then((m) => m.json()),
  jsonc: () => JSON_LANG().then((m) => m.json()),
  md: () => MD().then((m) => m.markdown()),
  markdown: () => MD().then((m) => m.markdown()),
  py: () => PY().then((m) => m.python()),
  pyw: () => PY().then((m) => m.python()),
  rs: () => import("@codemirror/lang-rust").then((m) => m.rust()),
  java: () => import("@codemirror/lang-java").then((m) => m.java()),
  c: () => CPP().then((m) => m.cpp()),
  h: () => CPP().then((m) => m.cpp()),
  cpp: () => CPP().then((m) => m.cpp()),
  cc: () => CPP().then((m) => m.cpp()),
  cxx: () => CPP().then((m) => m.cpp()),
  hpp: () => CPP().then((m) => m.cpp()),
  go: () => import("@codemirror/lang-go").then((m) => m.go()),
  sql: () => import("@codemirror/lang-sql").then((m) => m.sql()),
  php: () => import("@codemirror/lang-php").then((m) => m.php()),
  yaml: () => YAML().then((m) => m.yaml()),
  yml: () => YAML().then((m) => m.yaml()),
  sh: () => stream(import("@codemirror/legacy-modes/mode/shell"), "shell"),
  bash: () => stream(import("@codemirror/legacy-modes/mode/shell"), "shell"),
  zsh: () => stream(import("@codemirror/legacy-modes/mode/shell"), "shell"),
  rb: () => stream(import("@codemirror/legacy-modes/mode/ruby"), "ruby"),
  lua: () => stream(import("@codemirror/legacy-modes/mode/lua"), "lua"),
  toml: () => stream(import("@codemirror/legacy-modes/mode/toml"), "toml"),
  ini: () => stream(PROPERTIES(), "properties"),
  conf: () => stream(PROPERTIES(), "properties"),
  properties: () => stream(PROPERTIES(), "properties"),
  cfg: () => stream(PROPERTIES(), "properties"),
  env: () => stream(PROPERTIES(), "properties"),
  dockerfile: () => stream(import("@codemirror/legacy-modes/mode/dockerfile"), "dockerFile"),
};

export function fileExtension(path: string): string {
  const name = path.split("/").pop() ?? path;
  const lower = name.toLowerCase();
  if (lower === "dockerfile") return "dockerfile";
  // .gitignore / .env 这类点文件：整段后缀当作扩展名
  if (lower.startsWith(".") && lower.indexOf(".", 1) === -1) return lower.slice(1);
  const idx = name.lastIndexOf(".");
  return idx > 0 ? name.slice(idx + 1).toLowerCase() : "";
}

/** 异步加载语法包：只有真正打开对应类型文件时才会请求该 chunk */
export async function loadLanguageFor(path: string): Promise<Extension | null> {
  const loader = LOADERS[fileExtension(path)];
  if (!loader) return null;
  try {
    return await loader();
  } catch (e) {
    console.warn("加载语法高亮失败", path, e);
    return null;
  }
}

export function languageName(path: string): string {
  return NAMES[fileExtension(path)] ?? "纯文本";
}
