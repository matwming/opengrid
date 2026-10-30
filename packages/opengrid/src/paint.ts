export interface PaintColumn {
  colId: string;
  x: number;
  width: number;
  pinned: 'left' | 'right' | null;
  checkbox: boolean;
}

export interface PaintFrame {
  width: number;
  height: number;
  dpr: number;
  rowHeight: number;
  firstRow: number;
  rowOffset: number;
  viewCount: number;
  leftWidth: number;
  rightWidth: number;
  scrollLeft: number;
  columns: readonly PaintColumn[];
  sourceAt: (displayIndex: number) => number;
  textAt: (source: number, colId: string) => string;
  groupText?: (display: number, colId: string) => string;
  selected: (source: number) => boolean;
  styleAt?: (source: number, colId: string) => { background: string | null; color: string | null } | null;
  focusColId: string | null;
  focusRow: number | null;
  colors: PaintColors;
}

export interface PaintColors {
  bg: string;
  stripe: string;
  text: string;
  line: string;
  selected: string;
  focus: string;
  checkbox: string;
  muted: string;
}

export const FALLBACK_COLORS: PaintColors = {
  bg: '#f4efe6',
  stripe: '#ebe4d6',
  text: '#241c16',
  line: '#ddd2c2',
  selected: '#f6d7c4',
  focus: '#c4552a',
  checkbox: '#243027',
  muted: '#8a7b6b',
};

export function paintFrame(ctx: CanvasRenderingContext2D, frame: PaintFrame): void {
  const { width, height, dpr, rowHeight } = frame;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = frame.colors.bg;
  ctx.fillRect(0, 0, width, height);
  const visible = Math.ceil(height / rowHeight) + 2;
  ctx.font = '13px "Liberation Sans", "Avenir Next", "Segoe UI", sans-serif';
  ctx.textBaseline = 'middle';
  for (let slot = 0; slot < visible; slot++) {
    const display = frame.firstRow + slot;
    if (display < 0 || display >= frame.viewCount) continue;
    const y = slot * rowHeight - frame.rowOffset;
    const source = frame.sourceAt(display);
    const grouped = source < 0 && frame.groupText;
    if (source < 0 && !grouped) continue;
    const selected = source < 0 ? false : frame.selected(source);
    if (selected || display % 2 === 1) {
      ctx.fillStyle = selected ? frame.colors.selected : frame.colors.stripe;
      ctx.fillRect(0, y, width, rowHeight);
    }
    for (const column of frame.columns) {
      const screenX = screenXOf(column, frame);
      if (screenX + column.width < 0 || screenX > width) continue;
      if (column.pinned == null && (screenX + column.width < frame.leftWidth || screenX > width - frame.rightWidth)) continue;
      const style = source < 0 ? null : frame.styleAt?.(source, column.colId) ?? null;
      if (style?.background) {
        ctx.fillStyle = style.background;
        ctx.fillRect(screenX, y, column.width, rowHeight);
      }
      if (column.checkbox && source >= 0) drawCheckbox(ctx, screenX, y, column.width, rowHeight, selected, frame.colors);
      else drawText(ctx, source < 0 ? frame.groupText?.(display, column.colId) ?? '' : frame.textAt(source, column.colId), screenX, y, column.width, rowHeight, style?.color ?? frame.colors.text);
      if (frame.focusRow === display && frame.focusColId === column.colId) {
        ctx.strokeStyle = frame.colors.focus;
        ctx.lineWidth = 2;
        ctx.strokeRect(screenX + 1, y + 1, column.width - 2, rowHeight - 2);
      }
    }
  }
  ctx.fillStyle = frame.colors.line;
  const rows = Math.ceil(height / rowHeight) + 1;
  for (let line = 0; line <= rows; line++) {
    const y = line * rowHeight - frame.rowOffset;
    ctx.fillRect(0, Math.round(y), width, 1);
  }
  for (const column of frame.columns) {
    const screenX = screenXOf(column, frame);
    ctx.fillRect(Math.round(screenX + column.width) - 1, 0, 1, height);
  }
  if (frame.leftWidth > 0) {
    ctx.fillStyle = 'rgba(36, 48, 39, 0.08)';
    ctx.fillRect(frame.leftWidth - 1, 0, 1, height);
  }
  if (frame.rightWidth > 0) {
    ctx.fillStyle = 'rgba(36, 48, 39, 0.08)';
    ctx.fillRect(width - frame.rightWidth, 0, 1, height);
  }
}

function screenXOf(column: PaintColumn, frame: PaintFrame): number {
  if (column.pinned === 'left') return column.x;
  if (column.pinned === 'right') return frame.width - frame.rightWidth + column.x;
  return frame.leftWidth + column.x - frame.scrollLeft;
}

function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, height: number, color: string): void {
  if (!text) return;
  ctx.fillStyle = color;
  const pad = 8;
  if (text.length * 7.2 > width - pad * 2) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();
    ctx.fillText(text, x + pad, y + height / 2);
    ctx.restore();
    return;
  }
  ctx.fillText(text, x + pad, y + height / 2);
}

function drawCheckbox(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, checked: boolean, colors: PaintColors): void {
  const size = 14;
  const left = x + (width - size) / 2;
  const top = y + (height - size) / 2;
  ctx.strokeStyle = colors.checkbox;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(left, top, size, size);
  if (!checked) return;
  ctx.beginPath();
  ctx.moveTo(left + 3, top + 7);
  ctx.lineTo(left + 6, top + 11);
  ctx.lineTo(left + 11, top + 3);
  ctx.stroke();
}

export function checkboxBox(columnX: number, columnWidth: number, rowY: number, rowHeight: number): { x: number; y: number; size: number } {
  const size = 14;
  return { x: columnX + (columnWidth - size) / 2, y: rowY + (rowHeight - size) / 2, size };
}
