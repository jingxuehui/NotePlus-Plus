export interface PaletteCommand {
  id: string;
  title: string;
  group: string;
  shortcut?: string;
  /** 额外搜索关键词（别名），便于中英文模糊匹配 */
  keywords?: string;
  run: () => void | Promise<void>;
}

/** App 启动时注册，命令面板读取 */
export const paletteCommands: PaletteCommand[] = [];

export function registerCommands(commands: PaletteCommand[]) {
  paletteCommands.splice(0, paletteCommands.length, ...commands);
}
