const RECENT_KEY = "noteplus.recent";
const MAX_RECENT = 10;

export function getRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return [];
}

export function pushRecent(path: string) {
  const list = getRecent().filter((p) => p !== path);
  list.unshift(path);
  while (list.length > MAX_RECENT) list.pop();
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
}

export function clearRecent() {
  localStorage.removeItem(RECENT_KEY);
}
