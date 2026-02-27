import { describe, it, expect } from 'vitest';
import { resolveDropOrder } from '@/utils/drop-order';

describe('resolveDropOrder', () => {
  it('returns "a0" when list is empty (no before, no after)', () => {
    expect(resolveDropOrder()).toBe('a0');
    expect(resolveDropOrder(undefined, undefined)).toBe('a0');
  });

  it('returns a string BEFORE after when inserting at start (multi-char after)', () => {
    const result = resolveDropOrder(undefined, 'a0');
    expect(result < 'a0').toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns a string BEFORE after when inserting at start (single-char after)', () => {
    const result = resolveDropOrder(undefined, 'b');
    expect(result < 'b').toBe(true);
  });

  it('handles single-char after: returns \\x01 which sorts before "a"', () => {
    const result = resolveDropOrder(undefined, 'a');
    expect(result < 'a').toBe(true);
    expect(result.length).toBeGreaterThan(0); // no longer returns empty string
  });

  it('returns a string AFTER before when inserting at end', () => {
    const result = resolveDropOrder('z1gqm8xq');
    expect(result > 'z1gqm8xq').toBe(true);
  });

  it('returns a string BETWEEN before and after (normal range)', () => {
    const result = resolveDropOrder('a0', 'a0z');
    expect(result > 'a0').toBe(true);
    expect(result < 'a0z').toBe(true);
  });

  it('returns a string BETWEEN before and after (tight gap — prev bug)', () => {
    const result = resolveDropOrder('a0', 'a01');
    expect(result > 'a0').toBe(true);
    expect(result < 'a01').toBe(true);
  });

  it('works for a widely-spaced range', () => {
    const result = resolveDropOrder('a0', 'z1gqm8xq');
    expect(result > 'a0').toBe(true);
    expect(result < 'z1gqm8xq').toBe(true);
  });

  it('returns a string BETWEEN "a" and "b" (spec case 5)', () => {
    const result = resolveDropOrder('a', 'b');
    expect(result > 'a').toBe(true);
    expect(result < 'b').toBe(true);
  });

  it('returns a string BETWEEN "a0" and "a1" (spec case 6)', () => {
    const result = resolveDropOrder('a0', 'a1');
    expect(result > 'a0').toBe(true);
    expect(result < 'a1').toBe(true);
  });
});
