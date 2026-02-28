import { describe, it, expect } from 'vitest';
import { resolveStyles, resolveTokens } from './PageRenderer';

describe('resolveStyles', () => {
  it('returns base styles unchanged when no device', () => {
    const styles = { fontSize: '16px', color: '#111' };
    expect(resolveStyles(styles)).toEqual({ fontSize: '16px', color: '#111' });
  });

  it('strips _sm, _md, _lg, _hover keys from base output', () => {
    const styles = {
      padding: '60px',
      _sm: { padding: '20px' },
      _hover: { opacity: '0.8' },
    };
    const result = resolveStyles(styles);
    expect(result).toEqual({ padding: '60px' });
    expect('_sm' in result).toBe(false);
    expect('_hover' in result).toBe(false);
  });

  it('merges _sm overrides when device is "mobile"', () => {
    const styles = {
      padding: '60px',
      fontSize: '24px',
      _sm: { padding: '20px' },
    };
    const result = resolveStyles(styles, undefined, 'mobile');
    expect(result.padding).toBe('20px');    // overridden
    expect(result.fontSize).toBe('24px');   // base preserved
  });

  it('does not apply _sm overrides for desktop (no device)', () => {
    const styles = { padding: '60px', _sm: { padding: '20px' } };
    expect(resolveStyles(styles, undefined, undefined).padding).toBe('60px');
  });

  it('handles empty styles object', () => {
    expect(resolveStyles({})).toEqual({});
  });

  it('handles null/undefined gracefully', () => {
    expect(() => resolveStyles(null)).not.toThrow();
    expect(() => resolveStyles(undefined)).not.toThrow();
    expect(resolveStyles(null)).toEqual({});
    expect(resolveStyles(undefined)).toEqual({});
  });
});

describe('resolveTokens', () => {
  it('replaces {{store.name}} with value from data', () => {
    const result = resolveTokens('Welcome to {{store.name}}', { store: { name: 'SeloraX' } });
    expect(result).toBe('Welcome to SeloraX');
  });

  it('replaces nested paths', () => {
    const result = resolveTokens('{{a.b.c}}', { a: { b: { c: 'deep' } } });
    expect(result).toBe('deep');
  });

  it('leaves unknown tokens as empty string', () => {
    const result = resolveTokens('Hello {{unknown.key}}', {});
    expect(result).toBe('Hello ');
  });

  it('replaces multiple tokens in one string', () => {
    const result = resolveTokens('{{a}} and {{b}}', { a: 'foo', b: 'bar' });
    expect(result).toBe('foo and bar');
  });

  it('returns non-token strings unchanged', () => {
    expect(resolveTokens('No tokens here', {})).toBe('No tokens here');
  });

  it('handles non-string data value (number → string)', () => {
    const result = resolveTokens('{{count}}', { count: 42 });
    expect(result).toBe('42');
  });

  it('handles null/undefined data without throwing', () => {
    expect(() => resolveTokens('{{x}}', null)).not.toThrow();
    expect(resolveTokens('{{x}}', null)).toBe('');
    expect(resolveTokens('{{x}}', undefined)).toBe('');
  });
});
