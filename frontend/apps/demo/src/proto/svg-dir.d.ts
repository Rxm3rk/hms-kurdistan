/**
 * Prototype charts set `dir="ltr"` on their <svg> so time runs left to right in every locale. `dir` is a
 * global attribute that browsers honour on SVG elements and React passes through, but React's SVG prop
 * types leave it out; this adds it.
 */
import 'react';

declare module 'react' {
  interface SVGAttributes<T> {
    dir?: 'ltr' | 'rtl' | 'auto' | (string & {}) | undefined;
  }
}
