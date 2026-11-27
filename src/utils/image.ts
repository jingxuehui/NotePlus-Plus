import { fileExtension } from "@/editor/language";

/** 可预览的图片扩展名 → MIME 类型（svg 是可编辑的文本，仍按文本打开） */
const IMAGE_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  ico: "image/x-icon",
  avif: "image/avif",
};

export function imageMime(path: string): string | null {
  return IMAGE_MIME[fileExtension(path)] ?? null;
}

export function isImagePath(path: string): boolean {
  return imageMime(path) !== null;
}

/** 字节数格式化为 B / KB / MB */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
