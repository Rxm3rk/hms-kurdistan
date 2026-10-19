import { createRequire } from 'node:module';
const require = createRequire(process.cwd() + '/package.json');
const fontkit = require('fontkit');
const letters = ['ڕ','ڵ','ۆ','ێ','ە','ڤ','گ','چ','پ','ژ','ی','ک','ه','ي','ك','ا','ب'];
const digits = '0123456789'.split('');
for (const f of process.argv.slice(2)) {
  const font = fontkit.openSync(f);
  const miss = (cs) => cs.filter((c) => !font.hasGlyphForCodePoint(c.codePointAt(0)));
  console.log(f.split('/').pop(), font.familyName, 'glyphs', font.numGlyphs, 'missing letters:', miss(letters).join(' ') || 'none', 'missing digits:', miss(digits).join('') || 'none');
}
