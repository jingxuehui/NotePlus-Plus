export interface CursorInfo {
  line: number;
  col: number;
  selected: number;
  lines: number;
  chars: number;
  /** 当前选区数量（多光标时 >1） */
  cursors: number;
  /** 当前已折叠区域数量 */
  folded: number;
}

export const EMPTY_CURSOR: CursorInfo = {
  line: 1,
  col: 1,
  selected: 0,
  lines: 1,
  chars: 0,
  cursors: 1,
  folded: 0,
};
