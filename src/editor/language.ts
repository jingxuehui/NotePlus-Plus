import { LanguageSupport, StreamLanguage } from "@codemirror/language";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { rust } from "@codemirror/lang-rust";
import { sql } from "@codemirror/lang-sql";
import { xml } from "@codemirror/lang-xml";
import { yaml } from "@codemirror/lang-yaml";
import { go } from "@codemirror/lang-go";
import { php } from "@codemirror/lang-php";
import { vue } from "@codemirror/lang-vue";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { ruby } from "@codemirror/legacy-modes/mode/ruby";
import { lua } from "@codemirror/legacy-modes/mode/lua";
import { toml } from "@codemirror/legacy-modes/mode/toml";
import { properties } from "@codemirror/legacy-modes/mode/properties";
import { dockerFile } from "@codemirror/legacy-modes/mode/dockerfile";

export interface LanguageDef {
  name: string;
  factory: () => LanguageSupport;
}

const extensions: Record<string, LanguageDef> = {
  js: { name: "JavaScript", factory: () => javascript() },
  mjs: { name: "JavaScript", factory: () => javascript() },
  cjs: { name: "JavaScript", factory: () => javascript() },
  jsx: { name: "JSX", factory: () => javascript({ jsx: true }) },
  ts: { name: "TypeScript", factory: () => javascript({ typescript: true }) },
  mts: { name: "TypeScript", factory: () => javascript({ typescript: true }) },
  tsx: {
    name: "TypeScript JSX",
    factory: () => javascript({ typescript: true, jsx: true }),
  },
  vue: { name: "Vue", factory: () => vue() },
  html: { name: "HTML", factory: () => html() },
  htm: { name: "HTML", factory: () => html() },
  xml: { name: "XML", factory: () => xml() },
  svg: { name: "XML", factory: () => xml() },
  css: { name: "CSS", factory: () => css() },
  scss: { name: "CSS", factory: () => css() },
  less: { name: "CSS", factory: () => css() },
  json: { name: "JSON", factory: () => json() },
  jsonc: { name: "JSON", factory: () => json() },
  md: { name: "Markdown", factory: () => markdown() },
  markdown: { name: "Markdown", factory: () => markdown() },
  py: { name: "Python", factory: () => python() },
  pyw: { name: "Python", factory: () => python() },
  rs: { name: "Rust", factory: () => rust() },
  java: { name: "Java", factory: () => java() },
  c: { name: "C", factory: () => cpp() },
  h: { name: "C", factory: () => cpp() },
  cpp: { name: "C++", factory: () => cpp() },
  cc: { name: "C++", factory: () => cpp() },
  cxx: { name: "C++", factory: () => cpp() },
  hpp: { name: "C++", factory: () => cpp() },
  go: { name: "Go", factory: () => go() },
  sql: { name: "SQL", factory: () => sql() },
  php: { name: "PHP", factory: () => php() },
  yaml: { name: "YAML", factory: () => yaml() },
  yml: { name: "YAML", factory: () => yaml() },
  sh: { name: "Shell", factory: () => new LanguageSupport(StreamLanguage.define(shell)) },
  bash: { name: "Shell", factory: () => new LanguageSupport(StreamLanguage.define(shell)) },
  zsh: { name: "Shell", factory: () => new LanguageSupport(StreamLanguage.define(shell)) },
  rb: { name: "Ruby", factory: () => new LanguageSupport(StreamLanguage.define(ruby)) },
  lua: { name: "Lua", factory: () => new LanguageSupport(StreamLanguage.define(lua)) },
  toml: { name: "TOML", factory: () => new LanguageSupport(StreamLanguage.define(toml)) },
  ini: { name: "INI", factory: () => new LanguageSupport(StreamLanguage.define(properties)) },
  conf: { name: "INI", factory: () => new LanguageSupport(StreamLanguage.define(properties)) },
  properties: { name: "INI", factory: () => new LanguageSupport(StreamLanguage.define(properties)) },
  env: { name: "INI", factory: () => new LanguageSupport(StreamLanguage.define(properties)) },
  dockerfile: { name: "Dockerfile", factory: () => new LanguageSupport(StreamLanguage.define(dockerFile)) },
};

export function fileExtension(path: string): string {
  const name = path.split("/").pop() ?? path;
  if (name.toLowerCase() === "dockerfile") return "dockerfile";
  const idx = name.lastIndexOf(".");
  return idx > 0 ? name.slice(idx + 1).toLowerCase() : "";
}

export function languageFor(path: string): LanguageSupport | null {
  const def = extensions[fileExtension(path)];
  return def ? def.factory() : null;
}

export function languageName(path: string): string {
  const def = extensions[fileExtension(path)];
  return def ? def.name : "纯文本";
}
