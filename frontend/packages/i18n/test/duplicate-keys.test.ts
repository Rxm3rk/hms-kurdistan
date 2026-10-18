import { describe, expect, it } from 'vitest';
import { findDuplicateKeys } from '../src/lint/duplicate-keys.ts';

describe('findDuplicateKeys', () => {
  it('finds nothing in an object without repeated keys', () => {
    expect(findDuplicateKeys('{"a.b": "x", "a.c": "y"}')).toEqual([]);
  });

  it('reports a repeated key with its line', () => {
    expect(findDuplicateKeys('{\n  "a.b": "x",\n  "a.c": "y",\n  "a.b": "z"\n}')).toEqual([
      { key: 'a.b', path: '$', line: 4 },
    ]);
  });

  it('compares decoded keys, so an escaped spelling is the same key', () => {
    expect(findDuplicateKeys('{"ab": 1, "a\\u0062": 2}')).toEqual([{ key: 'ab', path: '$', line: 1 }]);
  });

  it('does not take string values, or keys inside values, for keys', () => {
    expect(findDuplicateKeys('{"a": "a", "b": "{\\"a\\": 1, \\"a\\": 2}"}')).toEqual([]);
  });

  it('treats each object separately and names nested paths', () => {
    expect(findDuplicateKeys('{"x": {"k": 1}, "y": {"k": 2}}')).toEqual([]);
    expect(findDuplicateKeys('{"x": {"k": 1, "k": 2}}')).toEqual([{ key: 'k', path: '$.x', line: 1 }]);
    expect(findDuplicateKeys('{"list": [{"k": 1}, {"k": 1, "k": 2}]}')).toEqual([
      { key: 'k', path: '$.list[1]', line: 1 },
    ]);
  });
});
