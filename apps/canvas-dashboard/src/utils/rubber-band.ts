export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Returns true if two rectangles have strict overlap (touching edges excluded). */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/** Normalize two points into a well-formed Rect (positive width/height). */
export function buildSelectionRect(start: Point, end: Point): Rect {
  return {
    x:      Math.min(start.x, end.x),
    y:      Math.min(start.y, end.y),
    width:  Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}
