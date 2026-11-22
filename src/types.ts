export interface CursorInfo {
  line: number;
  col: number;
  selected: number;
  lines: number;
  chars: number;
}

export const EMPTY_CURSOR: CursorInfo = {
  line: 1,
  col: 1,
  selected: 0,
  lines: 1,
  chars: 0,
};
