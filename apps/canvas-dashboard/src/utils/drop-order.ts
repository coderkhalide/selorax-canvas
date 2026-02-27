/**
 * Calculate a sort-order string that places an item between `before` and `after`.
 * The canvas uses lexicographic ordering for the `order` column.
 *
 *   resolveDropOrder()                → 'a0'   (empty list)
 *   resolveDropOrder(undefined, 'a0') → 'a'    (before first: trim last char)
 *   resolveDropOrder(undefined, 'a')  → '\x01' (before 'a': min sentinel, prevents empty string)
 *   resolveDropOrder('z1abc')         → 'z1abcz' (after last)
 *   resolveDropOrder('a0', 'a0z')     → 'a0y'  (between: largest char that fits)
 *   resolveDropOrder('a0', 'a01')     → 'a00'  (tight gap: tries down to '0')
 */
export function resolveDropOrder(before?: string, after?: string): string {
  if (!before && !after) return 'a0';

  // Insert BEFORE the first item: shorten `after` by one char.
  // A shorter string with the same prefix always sorts before the original.
  if (!before) {
    const shortened = after!.slice(0, -1);
    // If shortened is empty (after was single char), use a low-char prefix instead
    return shortened.length > 0 ? shortened : '\x01';
  }

  // Insert AFTER the last item: append 'z' (high char, guaranteed > before).
  if (!after) return before + 'z';

  // Insert BETWEEN before and after: append the largest char c such that
  // before + c < after. We try from 'z' down to '0', then fall back to '\x01'.
  const CANDIDATES = 'zyxwvutsrqponmlkjihgfedcba9876543210';
  for (const c of CANDIDATES) {
    const candidate = before + c;
    if (candidate < after) return candidate;
  }
  return before + '\x01';
}
