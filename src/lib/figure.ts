/** 0, "0", "0 đ", "0%": a figure that says nothing has happened yet. */
export function isEmptyFigure(value: unknown): boolean {
  if (value === 0) return true;
  if (typeof value !== "string") return false;
  return /^\s*0([.,]0+)?\s*(đ|₫|%)?\s*$/.test(value);
}
