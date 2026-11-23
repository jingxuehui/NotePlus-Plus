import { reactive } from "vue";

/** 全局悬浮提示：统一接管所有 title / v-tip 提示，样式由 GlobalTooltip 渲染 */
export const tipState = reactive({
  visible: false,
  text: "",
  x: 0,
  y: 0,
  placement: "top" as "top" | "bottom",
  compact: false,
});

export function showTip(text: string, rect: DOMRect): void {
  if (!text) return;
  tipState.text = text;
  // 顶部区域的目标没有足够空间在上方显示，改为显示在下方（箭头朝上）
  // 顶栏空间有限，提示使用更紧凑的字号和内边距
  tipState.compact = rect.top < 64;
  tipState.placement = tipState.compact ? "bottom" : "top";
  tipState.x = rect.left + rect.width / 2;
  tipState.y =
    tipState.placement === "top" ? rect.top - 10 : rect.bottom + 10;
  tipState.visible = true;
}

export function hideTip(): void {
  tipState.visible = false;
}

/** 把原生 title 提示转换为自定义气泡，返回卸载函数 */
export function installGlobalTooltip(): () => void {
  let current: HTMLElement | null = null;

  function targetOf(e: Event): HTMLElement | null {
    const el = e.target;
    return el instanceof Element ? el.closest<HTMLElement>("[title], [data-tip]") : null;
  }

  function onOver(e: MouseEvent) {
    const el = targetOf(e);
    if (!el) return;
    const text = el.dataset.tip || el.getAttribute("title") || "";
    if (!text) return;
    // 去掉原生 title，避免与自定义气泡重叠；内容保存在 data-tip 中
    if (el.hasAttribute("title")) {
      el.dataset.tip = text;
      el.removeAttribute("title");
    }
    if (current === el) return;
    current = el;
    showTip(text, el.getBoundingClientRect());
  }

  function onOut(e: MouseEvent) {
    if (!current) return;
    const related = e.relatedTarget;
    if (related instanceof Node && current.contains(related)) return;
    current = null;
    hideTip();
  }

  function onScrollOrBlur() {
    current = null;
    hideTip();
  }

  // Vue 动态更新 :title 时重新同步（例如主题按钮的提示文案会随主题变化）
  const observer = new MutationObserver((records) => {
    for (const rec of records) {
      const el = rec.target as HTMLElement;
      if (rec.attributeName !== "title" || !el.hasAttribute("title")) continue;
      const text = el.getAttribute("title") || "";
      if (text) el.dataset.tip = text;
      el.removeAttribute("title");
      if (current === el && text) showTip(text, el.getBoundingClientRect());
    }
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["title"],
    subtree: true,
  });
  // 安装时就收走已有的原生 title，避免首次悬浮闪出系统原生提示（大问号光标/气泡）
  document.querySelectorAll<HTMLElement>("[title]").forEach((el) => {
    const text = el.getAttribute("title") || "";
    if (text) el.dataset.tip = text;
    el.removeAttribute("title");
  });

  document.addEventListener("mouseover", onOver, true);
  document.addEventListener("mouseout", onOut, true);
  document.addEventListener("mousedown", onScrollOrBlur, true);
  window.addEventListener("scroll", onScrollOrBlur, true);
  window.addEventListener("blur", onScrollOrBlur);
  return () => {
    observer.disconnect();
    document.removeEventListener("mouseover", onOver, true);
    document.removeEventListener("mouseout", onOut, true);
    document.removeEventListener("mousedown", onScrollOrBlur, true);
    window.removeEventListener("scroll", onScrollOrBlur, true);
    window.removeEventListener("blur", onScrollOrBlur);
  };
}
