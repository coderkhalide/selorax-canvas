import { describe, it, expect } from 'vitest';
import { rectsIntersect, buildSelectionRect } from '@/utils/rubber-band';

describe('rectsIntersect', () => {
  it('fully contained returns true', () => {
    expect(rectsIntersect(
      { x: 10, y: 10, width: 20, height: 20 },
      { x: 5, y: 5, width: 100, height: 100 },
    )).toBe(true);
  });

  it('no overlap returns false', () => {
    expect(rectsIntersect(
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 20, y: 20, width: 10, height: 10 },
    )).toBe(false);
  });

  it('touching edges returns false (strict overlap needed)', () => {
    expect(rectsIntersect(
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 10, y: 0, width: 10, height: 10 },
    )).toBe(false);
  });

  it('partial overlap returns true', () => {
    expect(rectsIntersect(
      { x: 5, y: 5, width: 20, height: 20 },
      { x: 15, y: 15, width: 20, height: 20 },
    )).toBe(true);
  });
});

describe('buildSelectionRect', () => {
  it('normalizes reversed start/end', () => {
    const r = buildSelectionRect({ x: 50, y: 50 }, { x: 10, y: 20 });
    expect(r).toEqual({ x: 10, y: 20, width: 40, height: 30 });
  });

  it('normal direction passes through', () => {
    const r = buildSelectionRect({ x: 10, y: 20 }, { x: 50, y: 80 });
    expect(r).toEqual({ x: 10, y: 20, width: 40, height: 60 });
  });
});
