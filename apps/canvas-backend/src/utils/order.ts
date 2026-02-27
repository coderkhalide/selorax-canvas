// Fractional indexing helpers for canvas node ordering

const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export function generateOrder(after?: string, before?: string): string {
  if (!after && !before) return 'a0';
  if (!after)  return `${before!.slice(0, -1)}${prevChar(before!.slice(-1))}`;
  if (!before) return after + '0';

  // Simple midpoint between two strings
  if (after < before) {
    const mid = midpoint(after, before);
    if (mid) return mid;
  }
  return after + '0';
}

export function orderFirst(): string {
  return 'a0';
}

export function orderLast(): string {
  return `z${Date.now().toString(36)}`;
}

export function orderAfter(existing: string): string {
  return `m${Date.now().toString(36)}`;
}

function midpoint(a: string, b: string): string | null {
  const maxLen = Math.max(a.length, b.length);
  const pa = a.padEnd(maxLen, '0');
  const pb = b.padEnd(maxLen, '0');

  let result = '';
  for (let i = 0; i < maxLen; i++) {
    const ai = DIGITS.indexOf(pa[i]);
    const bi = DIGITS.indexOf(pb[i]);
    if (bi - ai > 1) {
      result += DIGITS[Math.floor((ai + bi) / 2)];
      return result + pa.slice(result.length);
    }
    result += pa[i];
  }
  return null;
}

function prevChar(c: string): string {
  const i = DIGITS.indexOf(c);
  return i > 0 ? DIGITS[i - 1] : '0';
}
