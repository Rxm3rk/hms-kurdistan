/**
 * Finds duplicate object keys in JSON text. JSON.parse keeps only the last of two equal keys, so a
 * duplicated message key would silently lose a message; the localisation lint reports it instead.
 * Call it only on text that JSON.parse accepts.
 */

export interface DuplicateKey {
  /** The decoded key. */
  readonly key: string;
  /** The JSON path of the object holding the key, for example `$` or `$.group`. */
  readonly path: string;
  /** The 1-based line of the repeated occurrence. */
  readonly line: number;
}

interface ObjectFrame {
  readonly kind: 'object';
  readonly path: string;
  readonly keys: Set<string>;
  expectingKey: boolean;
  lastKey: string | undefined;
}

interface ArrayFrame {
  readonly kind: 'array';
  readonly path: string;
  index: number;
}

type Frame = ObjectFrame | ArrayFrame;

/** The end index (exclusive) of the JSON string literal that starts at `start`. */
function stringEnd(text: string, start: number): number {
  let index = start + 1;
  while (index < text.length) {
    const character = text.charAt(index);
    if (character === '\\') {
      index += 2;
    } else if (character === '"') {
      return index + 1;
    } else {
      index += 1;
    }
  }
  return text.length;
}

function childPath(parent: Frame | undefined): string {
  if (parent === undefined) {
    return '$';
  }
  if (parent.kind === 'array') {
    return `${parent.path}[${String(parent.index)}]`;
  }
  return `${parent.path}.${parent.lastKey ?? ''}`;
}

export function findDuplicateKeys(text: string): DuplicateKey[] {
  const duplicates: DuplicateKey[] = [];
  const stack: Frame[] = [];
  let line = 1;
  for (let index = 0; index < text.length; index += 1) {
    const character = text.charAt(index);
    const top = stack.at(-1);
    switch (character) {
      case '\n':
        line += 1;
        break;
      case '"': {
        const end = stringEnd(text, index);
        if (top?.kind === 'object' && top.expectingKey) {
          const key = JSON.parse(text.slice(index, end)) as string;
          if (top.keys.has(key)) {
            duplicates.push({ key, path: top.path, line });
          }
          top.keys.add(key);
          top.lastKey = key;
          top.expectingKey = false;
        }
        index = end - 1;
        break;
      }
      case '{':
        stack.push({
          kind: 'object',
          path: childPath(top),
          keys: new Set(),
          expectingKey: true,
          lastKey: undefined,
        });
        break;
      case '[':
        stack.push({ kind: 'array', path: childPath(top), index: 0 });
        break;
      case '}':
      case ']':
        stack.pop();
        break;
      case ',':
        if (top?.kind === 'object') {
          top.expectingKey = true;
        } else if (top?.kind === 'array') {
          top.index += 1;
        }
        break;
      default:
        break;
    }
  }
  return duplicates;
}
